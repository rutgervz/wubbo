-- Wubbo database schema v0.2
-- Append-only enforced via triggers, event-sourced, RLS-protected

create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type source_type as enum (
  'claude_chat', 'youtube', 'podcast', 'document', 'article',
  'bookmark', 'note', 'email', 'voice_memo', 'social'
);

create type visibility as enum (
  'private_personal',
  'private_shared',
  'publication_draft',
  'public'
);

create type source_status as enum (
  'processing',    -- ingestion in progress
  'ready',         -- fully processed, searchable
  'quarantined',   -- awaiting human review
  'rejected'       -- reviewed and rejected
);

create type event_type as enum (
  'source_added', 'source_ready', 'source_quarantined',
  'source_approved', 'source_rejected',
  'chunk_created',
  'tag_added', 'tag_removed',
  'connection_suggested', 'connection_confirmed', 'connection_rejected',
  'publication_drafted', 'publication_approved', 'publication_published',
  'agent_search', 'agent_add_source', 'agent_suggest_connection',
  'agent_monitor_check', 'agent_write_draft',
  'backup_completed', 'system_error'
);

-- ============================================================
-- PERSONS (replaces hardcoded who check)
-- ============================================================

create table persons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

insert into persons (name, color) values
  ('Rutger', '#5ABFBF'),
  ('Annelie', '#E8795D');

-- ============================================================
-- CORE TABLES
-- ============================================================

create table sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  source_type source_type not null,
  original_url text,
  owner_id uuid not null references auth.users(id),
  visibility visibility not null default 'private_shared',
  status source_status not null default 'processing',

  raw_content text,
  summary text,
  file_path text,

  -- Herkomst
  ingested_via text not null default 'manual',
  external_id text,
  content_hash text,  -- sha256 of raw_content for dedup

  -- Agent metadata
  added_by_agent text,  -- 'research', 'monitor', etc. (text, not enum — extensible)
  confidence_score float check (confidence_score >= 0 and confidence_score <= 1),

  -- Person association
  person_id uuid references persons(id),

  source_date date,
  language text default 'nl'
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete restrict,
  created_at timestamptz not null default now(),

  content text not null,
  chunk_index int not null,
  parent_chunk_id uuid references chunks(id),  -- for parent-child retrieval

  embedding vector(512),

  token_count int,
  unique(source_id, chunk_index)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz not null default now()
);

create table source_tags (
  source_id uuid not null references sources(id) on delete restrict,
  tag_id uuid not null references tags(id),
  added_by text not null default 'human',
  confidence float default 1.0,
  created_at timestamptz not null default now(),
  primary key (source_id, tag_id)
);

-- ============================================================
-- KENNISGRAAF
-- ============================================================

create table graph_nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  color text,
  node_type text default 'theme',
  created_at timestamptz not null default now(),
  created_by text not null default 'human'
);

create table graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid not null references graph_nodes(id),
  to_node_id uuid not null references graph_nodes(id),

  is_confirmed boolean not null default false,
  suggested_by text,
  confirmed_by uuid references auth.users(id),

  strength float default 0.5,
  confidence float default 1.0,

  created_at timestamptz not null default now(),
  confirmed_at timestamptz,

  unique(from_node_id, to_node_id)
);

create table source_nodes (
  source_id uuid not null references sources(id) on delete restrict,
  node_id uuid not null references graph_nodes(id),
  relevance float default 1.0,
  created_at timestamptz not null default now(),
  primary key (source_id, node_id)
);

-- ============================================================
-- PUBLICATIE PIPELINE
-- ============================================================

create table publications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  title text not null,
  content text not null,
  slug text unique,

  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published')),

  channel text,
  drafted_by text,
  reviewed_by uuid references auth.users(id),
  published_at timestamptz
);

-- Proper join table instead of uuid array
create table publication_sources (
  publication_id uuid not null references publications(id),
  source_id uuid not null references sources(id),
  created_at timestamptz not null default now(),
  primary key (publication_id, source_id)
);

-- ============================================================
-- UNIFIED EVENT LOG (merged events + agent_actions)
-- ============================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  event_type event_type not null,
  actor text not null,  -- 'user:rutger', 'agent:research', 'system'

  -- References (all nullable — polymorphic)
  source_id uuid references sources(id),
  node_id uuid references graph_nodes(id),
  edge_id uuid references graph_edges(id),
  publication_id uuid references publications(id),

  -- Agent-specific fields (filled when actor starts with 'agent:')
  agent_action text,       -- 'search_web', 'add_source', etc.
  confidence float,
  duration_ms int,
  tokens_used int default 0,

  -- Details
  payload jsonb default '{}'
);

-- ============================================================
-- APPEND-ONLY ENFORCEMENT (database-level, not just RLS)
-- ============================================================

-- Block UPDATE on sources (except status transitions)
create or replace function enforce_source_append_only()
returns trigger as $$
begin
  -- Allow only status transitions and updated_at
  if OLD.raw_content is distinct from NEW.raw_content
    or OLD.title is distinct from NEW.title
    or OLD.source_type is distinct from NEW.source_type
    or OLD.external_id is distinct from NEW.external_id
    or OLD.content_hash is distinct from NEW.content_hash
  then
    raise exception 'Wubbo: sources are append-only. Content cannot be modified.';
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger sources_append_only
  before update on sources
  for each row execute function enforce_source_append_only();

-- Block DELETE on sources, chunks, events
create or replace function block_delete()
returns trigger as $$
begin
  raise exception 'Wubbo: delete is not permitted on this table.';
  return null;
end;
$$ language plpgsql;

create trigger sources_no_delete before delete on sources for each row execute function block_delete();
create trigger chunks_no_delete before delete on chunks for each row execute function block_delete();
create trigger events_no_delete before delete on events for each row execute function block_delete();

-- Block UPDATE on chunks (embeddings are immutable)
create or replace function block_chunk_update()
returns trigger as $$
begin
  raise exception 'Wubbo: chunks are immutable. Create new chunks instead.';
  return null;
end;
$$ language plpgsql;

create trigger chunks_no_update before update on chunks for each row execute function block_chunk_update();

-- Block UPDATE on events
create trigger events_no_update before update on events for each row execute function block_delete();

-- ============================================================
-- AUTO-UPDATE source_count via trigger (instead of denormalized)
-- ============================================================

create or replace function update_node_source_count()
returns trigger as $$
begin
  -- This runs after INSERT on source_nodes
  update graph_nodes
  set source_count = (select count(*) from source_nodes where node_id = NEW.node_id)
  where id = NEW.node_id;
  return NEW;
end;
$$ language plpgsql;

-- We need a source_count column
alter table graph_nodes add column if not exists source_count int default 0;

create trigger source_nodes_count_update
  after insert on source_nodes
  for each row execute function update_node_source_count();

-- ============================================================
-- INDEXES
-- ============================================================

-- Vector search: use HNSW (works on empty tables, better for <1M vectors)
create index on chunks using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- Full-text search
create index sources_fts on sources using gin (
  to_tsvector('dutch', coalesce(title, '') || ' ' || coalesce(raw_content, ''))
);

-- Deduplication
create unique index on sources (external_id) where external_id is not null;
create index on sources (content_hash) where content_hash is not null;

-- Common queries
create index on sources (source_type);
create index on sources (person_id);
create index on sources (visibility);
create index on sources (status);
create index on sources (created_at desc);
create index on chunks (source_id);
create index on graph_edges (from_node_id);
create index on graph_edges (to_node_id);
create index on graph_edges (is_confirmed);
create index on events (event_type);
create index on events (created_at desc);
create index on events (actor);
create index on publication_sources (source_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table persons enable row level security;
alter table sources enable row level security;
alter table chunks enable row level security;
alter table tags enable row level security;
alter table source_tags enable row level security;
alter table graph_nodes enable row level security;
alter table graph_edges enable row level security;
alter table source_nodes enable row level security;
alter table publications enable row level security;
alter table publication_sources enable row level security;
alter table events enable row level security;

-- Persons: everyone can read
create policy "persons_select" on persons for select using (true);

-- Sources: private_personal only for owner, rest for all authenticated
create policy "sources_select" on sources for select using (
  visibility != 'private_personal' or owner_id = auth.uid()
);
create policy "sources_insert" on sources for insert with check (true);
create policy "sources_update" on sources for update using (true);
-- DELETE blocked by trigger, not RLS

-- Chunks: follows source visibility
create policy "chunks_select" on chunks for select using (
  exists (
    select 1 from sources s where s.id = chunks.source_id
    and (s.visibility != 'private_personal' or s.owner_id = auth.uid())
  )
);
create policy "chunks_insert" on chunks for insert with check (true);

-- Tags: open
create policy "tags_all" on tags for all using (true);
create policy "source_tags_select" on source_tags for select using (true);
create policy "source_tags_insert" on source_tags for insert with check (true);

-- Graph: read all, insert all, update edges only for confirmation
create policy "graph_nodes_select" on graph_nodes for select using (true);
create policy "graph_nodes_insert" on graph_nodes for insert with check (true);
create policy "graph_edges_select" on graph_edges for select using (true);
create policy "graph_edges_insert" on graph_edges for insert with check (true);
create policy "graph_edges_update" on graph_edges for update using (true)
  with check (is_confirmed = true and confirmed_by = auth.uid());

create policy "source_nodes_select" on source_nodes for select using (true);
create policy "source_nodes_insert" on source_nodes for insert with check (true);

-- Publications
create policy "publications_select" on publications for select using (true);
create policy "publications_insert" on publications for insert with check (true);
create policy "publications_update" on publications for update using (true);
create policy "pub_sources_all" on publication_sources for all using (true);

-- Events: insert-only, everyone reads
create policy "events_select" on events for select using (true);
create policy "events_insert" on events for insert with check (true);

-- ============================================================
-- SEARCH FUNCTIONS
-- ============================================================

-- Semantic search with parent-child context
create or replace function search_chunks_with_context(
  query_embedding vector(512),
  match_threshold float default 0.65,
  match_count int default 15,
  filter_person_id uuid default null,
  filter_source_type source_type default null
)
returns table (
  chunk_id uuid,
  source_id uuid,
  content text,
  context_before text,
  context_after text,
  similarity float,
  source_title text,
  source_type source_type,
  person_name text,
  source_date date
)
language plpgsql
as $$
begin
  return query
  select
    c.id as chunk_id,
    s.id as source_id,
    c.content,
    -- Parent-child: get previous and next chunk content
    (select c2.content from chunks c2
     where c2.source_id = c.source_id and c2.chunk_index = c.chunk_index - 1
     limit 1) as context_before,
    (select c2.content from chunks c2
     where c2.source_id = c.source_id and c2.chunk_index = c.chunk_index + 1
     limit 1) as context_after,
    1 - (c.embedding <=> query_embedding) as similarity,
    s.title as source_title,
    s.source_type,
    p.name as person_name,
    s.source_date
  from chunks c
  join sources s on s.id = c.source_id
  left join persons p on p.id = s.person_id
  where
    s.status = 'ready'
    and (s.visibility != 'private_personal' or s.owner_id = auth.uid())
    and 1 - (c.embedding <=> query_embedding) > match_threshold
    and (filter_person_id is null or s.person_id = filter_person_id)
    and (filter_source_type is null or s.source_type = filter_source_type)
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Hybrid search: vector + full-text with RRF
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(512),
  match_count int default 15,
  filter_person_id uuid default null
)
returns table (
  source_id uuid,
  title text,
  source_type source_type,
  person_name text,
  source_date date,
  snippet text,
  score float
)
language plpgsql
as $$
begin
  return query
  with vector_results as (
    select s.id, s.title, s.source_type, p.name as person_name, s.source_date,
      coalesce(left(s.raw_content, 200), '') as snippet,
      1 - (c.embedding <=> query_embedding) as vscore,
      row_number() over (partition by s.id order by c.embedding <=> query_embedding) as rn
    from chunks c
    join sources s on s.id = c.source_id
    left join persons p on p.id = s.person_id
    where s.status = 'ready'
      and (s.visibility != 'private_personal' or s.owner_id = auth.uid())
      and (filter_person_id is null or s.person_id = filter_person_id)
    order by c.embedding <=> query_embedding
    limit match_count * 3
  ),
  fts_results as (
    select s.id, s.title, s.source_type, p.name as person_name, s.source_date,
      coalesce(left(s.raw_content, 200), '') as snippet,
      ts_rank(to_tsvector('dutch', coalesce(s.title, '') || ' ' || coalesce(s.raw_content, '')),
              plainto_tsquery('dutch', query_text)) as fts_score
    from sources s
    left join persons p on p.id = s.person_id
    where s.status = 'ready'
      and (s.visibility != 'private_personal' or s.owner_id = auth.uid())
      and (filter_person_id is null or s.person_id = filter_person_id)
      and to_tsvector('dutch', coalesce(s.title, '') || ' ' || coalesce(s.raw_content, ''))
          @@ plainto_tsquery('dutch', query_text)
    limit match_count * 2
  ),
  -- RRF: reciprocal rank fusion
  vector_ranked as (
    select id, title, source_type, person_name, source_date, snippet,
      1.0 / (60 + row_number() over (order by vscore desc)) as rrf_v
    from (select * from vector_results where rn = 1) vr
  ),
  fts_ranked as (
    select id, title, source_type, person_name, source_date, snippet,
      1.0 / (60 + row_number() over (order by fts_score desc)) as rrf_f
    from fts_results
  ),
  combined as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(v.title, f.title) as title,
      coalesce(v.source_type, f.source_type) as source_type,
      coalesce(v.person_name, f.person_name) as person_name,
      coalesce(v.source_date, f.source_date) as source_date,
      coalesce(v.snippet, f.snippet) as snippet,
      coalesce(v.rrf_v, 0) + coalesce(f.rrf_f, 0) as combined_score
    from vector_ranked v
    full outer join fts_ranked f on v.id = f.id
  )
  select id as source_id, title, source_type, person_name, source_date, snippet,
    combined_score as score
  from combined
  order by combined_score desc
  limit match_count;
end;
$$;

-- ============================================================
-- SEED DATA
-- ============================================================

insert into graph_nodes (label, color, node_type) values
  ('Florida', '#5ABFBF', 'project'),
  ('Re-Creation', '#E8795D', 'project'),
  ('Regeneratief', '#6AAF7A', 'theme'),
  ('Coöperatie', '#5ABFBF', 'theme'),
  ('Schiermonnikoog', '#6DD4D4', 'theme'),
  ('School', '#D4B98A', 'project'),
  ('NSW-landgoed', '#8A9AB0', 'theme'),
  ('Spiritueel', '#9B8DD6', 'theme'),
  ('Us Wente', '#D4B98A', 'project'),
  ('Energie', '#6AAF7A', 'theme'),
  ('Onderwijs', '#9B8DD6', 'theme'),
  ('Gastvrijheid', '#E8795D', 'theme'),
  ('Berkenplas', '#6AAF7A', 'project'),
  ('Fosfaatrechten', '#5ABFBF', 'concept'),
  ('Kringlopen', '#6AAF7A', 'concept'),
  ('Gemeenschap', '#6DD4D4', 'theme')
on conflict (label) do nothing;

insert into graph_edges (from_node_id, to_node_id, is_confirmed, strength)
select a.id, b.id, true, 0.8
from graph_nodes a, graph_nodes b
where (a.label, b.label) in (
  ('Florida', 'Re-Creation'), ('Florida', 'Regeneratief'),
  ('Florida', 'Coöperatie'), ('Florida', 'Schiermonnikoog'),
  ('Florida', 'NSW-landgoed'), ('Florida', 'Energie'),
  ('Florida', 'Fosfaatrechten'),
  ('Re-Creation', 'Spiritueel'), ('Re-Creation', 'Us Wente'),
  ('Re-Creation', 'Gastvrijheid'),
  ('Schiermonnikoog', 'School'), ('Schiermonnikoog', 'Gemeenschap'),
  ('Schiermonnikoog', 'Gastvrijheid'), ('Schiermonnikoog', 'Berkenplas'),
  ('School', 'Onderwijs'), ('Coöperatie', 'NSW-landgoed'),
  ('Regeneratief', 'Energie'), ('Regeneratief', 'Kringlopen'),
  ('Energie', 'Kringlopen')
)
on conflict (from_node_id, to_node_id) do nothing;

insert into tags (name, color) values
  ('Florida', '#5ABFBF'), ('Re-Creation', '#E8795D'),
  ('Regeneratief', '#6AAF7A'), ('Coöperatie', '#5ABFBF'),
  ('School', '#D4B98A'), ('Schiermonnikoog', '#6DD4D4'),
  ('Juridisch', '#8A9AB0'), ('Strategie', '#5ABFBF'),
  ('Inspiratie', '#E8795D'), ('Visie', '#9B8DD6'),
  ('Onderwijs', '#9B8DD6'), ('Energie', '#6AAF7A'),
  ('Investering', '#D4B98A'), ('Advocacy', '#D4B98A'),
  ('AI', '#9B8DD6')
on conflict (name) do nothing;
