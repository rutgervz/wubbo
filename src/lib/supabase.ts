import { createClient } from '@supabase/supabase-js';

export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type SourceType = 'claude_chat' | 'youtube' | 'podcast' | 'document' | 'article' | 'bookmark' | 'note' | 'email' | 'voice_memo' | 'social';
export type Visibility = 'private_personal' | 'private_shared' | 'publication_draft' | 'public';
export type SourceStatus = 'processing' | 'ready' | 'quarantined' | 'rejected';

export interface Person { id: string; name: string; color?: string; user_id?: string; }

export interface Source {
  id: string; created_at: string; title: string; source_type: SourceType;
  original_url?: string; owner_id: string; visibility: Visibility; status: SourceStatus;
  raw_content?: string; summary?: string; file_path?: string;
  ingested_via: string; external_id?: string; content_hash?: string;
  added_by_agent?: string; confidence_score?: number;
  person_id?: string; source_date?: string; language: string;
}

export interface SearchResult {
  source_id: string; title: string; source_type: SourceType;
  person_name?: string; source_date?: string; snippet: string; score: number;
}

export interface ChunkSearchResult {
  chunk_id: string; source_id: string; content: string;
  context_before?: string; context_after?: string;
  similarity: number; source_title: string; source_type: SourceType;
  person_name?: string; source_date?: string;
}
