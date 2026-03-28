import { createBrowserClient, type SearchResult, type ChunkSearchResult, type SourceType } from './supabase';

// ============================================================
// EMBEDDING (client-side via API route)
// ============================================================

// Simple cache to avoid duplicate embedding calls
const embeddingCache = new Map<string, number[]>();

async function getEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const { embedding } = await res.json();

  // Cache last 50 queries
  if (embeddingCache.size > 50) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(text, embedding);
  return embedding;
}

// ============================================================
// SEMANTIC SEARCH with parent-child context
// ============================================================

export async function semanticSearch(
  query: string,
  options: { personId?: string; sourceType?: SourceType; limit?: number } = {}
): Promise<ChunkSearchResult[]> {
  const embedding = await getEmbedding(query);
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('search_chunks_with_context', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: options.limit || 15,
    filter_person_id: options.personId || null,
    filter_source_type: options.sourceType || null,
  });

  if (error) { console.error('Search error:', error); return []; }

  // Deduplicate by source_id, keep highest similarity
  const seen = new Map<string, ChunkSearchResult>();
  for (const row of data || []) {
    const existing = seen.get(row.source_id);
    if (!existing || row.similarity > existing.similarity) {
      seen.set(row.source_id, row);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);
}

// ============================================================
// HYBRID SEARCH
// ============================================================

export async function hybridSearch(
  query: string,
  options: { personId?: string; limit?: number } = {}
): Promise<SearchResult[]> {
  const embedding = await getEmbedding(query);
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: query,
    query_embedding: embedding,
    match_count: options.limit || 15,
    filter_person_id: options.personId || null,
  });

  if (error) { console.error('Hybrid search error:', error); return []; }
  return data || [];
}

// ============================================================
// GRAPH QUERIES
// ============================================================

export async function getGraphData() {
  const supabase = createBrowserClient();
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from('graph_nodes').select('*').order('source_count', { ascending: false }),
    supabase.from('graph_edges').select('*, from_node:graph_nodes!from_node_id(label, color), to_node:graph_nodes!to_node_id(label, color)'),
  ]);
  return { nodes: nodesResult.data || [], edges: edgesResult.data || [] };
}

export async function getNodeContext(nodeLabel: string) {
  const supabase = createBrowserClient();

  const { data: node } = await supabase
    .from('graph_nodes').select('id').eq('label', nodeLabel).single();
  if (!node) return { nodes: [], edges: [], sources: [] };

  // Get connected edges and nodes
  const { data: edges } = await supabase
    .from('graph_edges')
    .select('*, from_node:graph_nodes!from_node_id(*), to_node:graph_nodes!to_node_id(*)')
    .or(`from_node_id.eq.${node.id},to_node_id.eq.${node.id}`);

  const connectedIds = new Set<string>([node.id]);
  for (const edge of edges || []) {
    connectedIds.add(edge.from_node_id);
    connectedIds.add(edge.to_node_id);
  }

  const [nodesResult, secondaryEdges, sourcesResult] = await Promise.all([
    supabase.from('graph_nodes').select('*').in('id', Array.from(connectedIds)),
    supabase.from('graph_edges').select('*')
      .in('from_node_id', Array.from(connectedIds))
      .in('to_node_id', Array.from(connectedIds)),
    // Get sources linked to this node for RAG context
    supabase.from('source_nodes')
      .select('source:sources(id, title, source_type, summary, source_date, person_id)')
      .eq('node_id', node.id)
      .limit(10),
  ]);

  return {
    nodes: nodesResult.data || [],
    edges: secondaryEdges.data || [],
    sources: sourcesResult.data?.map(sn => sn.source) || [],
    centerId: node.id,
  };
}

// ============================================================
// STREAM: recent sources (only 'ready' status)
// ============================================================

export async function getRecentSources(options: {
  limit?: number; personId?: string; sourceType?: SourceType; offset?: number;
} = {}) {
  const supabase = createBrowserClient();

  let query = supabase
    .from('sources')
    .select(`*, person:persons(name, color), source_tags(tag:tags(name, color)), source_nodes(node:graph_nodes(label, color))`)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(options.limit || 20);

  if (options.personId) query = query.eq('person_id', options.personId);
  if (options.sourceType) query = query.eq('source_type', options.sourceType);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error } = await query;
  if (error) console.error('Stream error:', error);
  return data || [];
}

// ============================================================
// QUARANTINE MANAGEMENT (via status, not boolean)
// ============================================================

export async function getQuarantineItems() {
  const supabase = createBrowserClient();
  const { data } = await supabase
    .from('sources')
    .select('*, person:persons(name), source_tags(tag:tags(name))')
    .eq('status', 'quarantined')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function approveQuarantineItem(sourceId: string) {
  const supabase = createBrowserClient();
  // Status transition: quarantined → ready (allowed by append-only trigger)
  await supabase.from('sources').update({ status: 'ready' }).eq('id', sourceId);
  await supabase.from('events').insert({
    event_type: 'source_approved',
    actor: `user:${(await supabase.auth.getUser()).data.user?.id || 'unknown'}`,
    source_id: sourceId,
  });
}

export async function rejectQuarantineItem(sourceId: string) {
  const supabase = createBrowserClient();
  // Status transition: quarantined → rejected (source stays in DB but invisible)
  await supabase.from('sources').update({ status: 'rejected' }).eq('id', sourceId);
  await supabase.from('events').insert({
    event_type: 'source_rejected',
    actor: `user:${(await supabase.auth.getUser()).data.user?.id || 'unknown'}`,
    source_id: sourceId,
  });
}

// ============================================================
// RAG CONTEXT BUILDER — the 7-layer context for Claude
// ============================================================

export async function buildRAGContext(query: string, options: { personId?: string } = {}) {
  // Layer 1+2: Chunk retrieval with parent-child context
  const chunks = await semanticSearch(query, { ...options, limit: 12 });

  // Layer 3: Get graph context for the top themes mentioned
  // (simplified: use tags from top results to find graph nodes)
  const topSourceIds = chunks.slice(0, 5).map(c => c.source_id);
  let graphContext: string[] = [];

  if (topSourceIds.length > 0) {
    const supabase = createBrowserClient();
    const { data: nodeLinks } = await supabase
      .from('source_nodes')
      .select('node:graph_nodes(label)')
      .in('source_id', topSourceIds);

    if (nodeLinks) {
      const nodeLabels = [...new Set(nodeLinks.map(nl => (nl.node as any)?.label).filter(Boolean))];
      graphContext = nodeLabels.map(l => `Verbonden thema: ${l}`);
    }
  }

  // Compose context string
  const contextParts: string[] = [];

  for (const chunk of chunks) {
    let entry = `--- ${chunk.source_title} (${chunk.source_type}, ${chunk.person_name || 'onbekend'}, ${chunk.source_date || 'onbekend'}) ---\n`;
    if (chunk.context_before) entry += `[context voor] ${chunk.context_before.substring(0, 150)}...\n`;
    entry += chunk.content;
    if (chunk.context_after) entry += `\n[context na] ${chunk.context_after.substring(0, 150)}...`;
    contextParts.push(entry);
  }

  if (graphContext.length > 0) {
    contextParts.push(`\n--- Kennisgraaf ---\n${graphContext.join('\n')}`);
  }

  return {
    context: contextParts.join('\n\n'),
    sourceCount: chunks.length,
    tokenEstimate: Math.ceil(contextParts.join('').length / 3.2),
  };
}
