import { createServiceClient, type SourceType } from './supabase';

// ============================================================
// CHUNKING — improved token estimation and minimum chunk size
// ============================================================

interface ChunkResult {
  content: string;
  index: number;
  tokenCount: number;
}

// Better token estimation for Dutch text (longer words, ~3.2 chars/token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

export function chunkText(text: string, maxTokens = 600): ChunkResult[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks: ChunkResult[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const combinedTokens = estimateTokens(currentChunk + '\n\n' + paragraph);

    if (currentChunk && combinedTokens > maxTokens) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: estimateTokens(currentChunk.trim()),
      });
      chunkIndex++;

      // Overlap: keep last two sentences for continuity
      const sentences = currentChunk.split(/(?<=[.!?])\s+/);
      const overlapSentences = sentences.slice(-2).join(' ');
      currentChunk = overlapSentences.length > 20 ? overlapSentences + '\n\n' : '';
    }

    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  // Last chunk — merge into previous if too small (<100 tokens)
  if (currentChunk.trim()) {
    const lastTokens = estimateTokens(currentChunk.trim());
    if (lastTokens < 100 && chunks.length > 0) {
      // Merge into previous chunk
      const prev = chunks[chunks.length - 1];
      prev.content += '\n\n' + currentChunk.trim();
      prev.tokenCount = estimateTokens(prev.content);
    } else {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: lastTokens,
      });
    }
  }

  return chunks;
}

// ============================================================
// EMBEDDING — with retry
// ============================================================

export async function generateEmbeddings(texts: string[], retries = 2): Promise<number[][]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({ model: 'voyage-3-lite', input: texts, input_type: 'document' }),
      });

      if (!response.ok) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.map((d: any) => d.embedding);
    } catch (err) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
      throw err;
    }
  }
  throw new Error('Embedding failed after retries');
}

// ============================================================
// AUTO-TAGGING
// ============================================================

const TAG_KEYWORDS: Record<string, string[]> = {
  'Florida': ['florida', 'boerderij', 'jersey koeien', 'zuivel', 'artisanaal'],
  'Re-Creation': ['re-creation', 'zelfvernieuwing', 'drie pijlers', 'continuous renewal'],
  'Regeneratief': ['regeneratief', 'bodem', 'kringlopen', 'biodiversiteit', 'gabe brown', 'joel salatin'],
  'Coöperatie': ['coöperatie', 'cooperative', 'founding members', 'governance', 'inverted consumer'],
  'School': ['school', 'yn de mande', 'onderwijs', 'directeur', 'meendering'],
  'Schiermonnikoog': ['schiermonnikoog', 'eiland', 'wadden', 'gastvrijheid'],
  'Juridisch': ['nsw', 'landgoed', 'fosfaatrechten', 'vbr', 'natura 2000', 'fiscaal'],
  'Energie': ['energie', 'mestvergisting', 'anaerobe', 'vergisting', 'biogas'],
  'Strategie': ['strategie', 'businessplan', 'investering', 'financiering'],
  'AI': ['ai', 'artificial intelligence', 'machine learning', 'claude', 'chatgpt'],
};

export function autoTag(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(TAG_KEYWORDS)
    .filter(([_, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([tag]) => tag);
}

// ============================================================
// CONTENT HASH for dedup
// ============================================================

async function contentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// FULL INGESTION PIPELINE v0.2
// ============================================================

export interface IngestInput {
  title: string;
  content: string;
  sourceType: SourceType;
  personName: 'Rutger' | 'Annelie' | 'Samen';
  ownerId: string;
  originalUrl?: string;
  externalId?: string;
  ingestedVia?: string;
  addedByAgent?: string;
  confidenceScore?: number;
  sourceDate?: string;
}

export interface IngestResult {
  sourceId: string;
  chunksCreated: number;
  tagsApplied: string[];
  status: 'ready' | 'quarantined' | 'duplicate';
}

export async function ingest(input: IngestInput): Promise<IngestResult> {
  const supabase = createServiceClient();

  // 1. Deduplicatie: external_id check
  if (input.externalId) {
    const { data: existing } = await supabase
      .from('sources').select('id').eq('external_id', input.externalId).maybeSingle();
    if (existing) return { sourceId: existing.id, chunksCreated: 0, tagsApplied: [], status: 'duplicate' };
  }

  // 2. Deduplicatie: content hash check
  const hash = await contentHash(input.content);
  const { data: hashMatch } = await supabase
    .from('sources').select('id').eq('content_hash', hash).maybeSingle();
  if (hashMatch) return { sourceId: hashMatch.id, chunksCreated: 0, tagsApplied: [], status: 'duplicate' };

  // 3. Resolve person
  const { data: person } = await supabase
    .from('persons').select('id').eq('name', input.personName).maybeSingle();

  // 4. Determine initial status
  const shouldQuarantine = input.addedByAgent && (input.confidenceScore ?? 1) < 0.5;

  // 5. Insert source as 'processing'
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .insert({
      title: input.title,
      source_type: input.sourceType,
      original_url: input.originalUrl,
      owner_id: input.ownerId,
      visibility: 'private_shared',
      status: 'processing',
      raw_content: input.content,
      ingested_via: input.ingestedVia || 'manual',
      external_id: input.externalId,
      content_hash: hash,
      added_by_agent: input.addedByAgent,
      confidence_score: input.confidenceScore,
      person_id: person?.id,
      source_date: input.sourceDate,
    })
    .select('id')
    .single();

  if (sourceError || !source) throw new Error(`Failed to insert source: ${sourceError?.message}`);

  try {
    // 6. Chunk content
    const chunks = chunkText(input.content);

    // 7. Generate embeddings (batches of 20, with retry)
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const embeddings = await generateEmbeddings(batch.map(c => c.content));
      allEmbeddings.push(...embeddings);
    }

    // 8. Store chunks — embedding as proper array format
    const chunkInserts = chunks.map((chunk, i) => ({
      source_id: source.id,
      content: chunk.content,
      chunk_index: chunk.index,
      embedding: `[${allEmbeddings[i].join(',')}]`,
      token_count: chunk.tokenCount,
    }));

    const { error: chunkError } = await supabase.from('chunks').insert(chunkInserts);
    if (chunkError) throw new Error(`Failed to insert chunks: ${chunkError.message}`);

    // 9. Auto-tag — batched lookup
    const detectedTags = autoTag(input.title + ' ' + input.content);
    if (detectedTags.length > 0) {
      const { data: tagRows } = await supabase
        .from('tags').select('id, name').in('name', detectedTags);

      if (tagRows && tagRows.length > 0) {
        const tagInserts = tagRows.map(t => ({
          source_id: source.id,
          tag_id: t.id,
          added_by: input.addedByAgent ? `agent:${input.addedByAgent}` : 'human',
          confidence: input.confidenceScore ?? 1.0,
        }));
        await supabase.from('source_tags').upsert(tagInserts, { onConflict: 'source_id,tag_id' });
      }
    }

    // 10. Transition to final status
    const finalStatus = shouldQuarantine ? 'quarantined' : 'ready';
    await supabase.from('sources').update({ status: finalStatus }).eq('id', source.id);

    // 11. Log event
    await supabase.from('events').insert({
      event_type: shouldQuarantine ? 'source_quarantined' : 'source_ready',
      actor: input.addedByAgent ? `agent:${input.addedByAgent}` : `user:${input.personName.toLowerCase()}`,
      source_id: source.id,
      confidence: input.confidenceScore,
      payload: {
        title: input.title, source_type: input.sourceType,
        chunks_created: chunks.length, tags: detectedTags,
      },
    });

    return {
      sourceId: source.id,
      chunksCreated: chunks.length,
      tagsApplied: detectedTags,
      status: finalStatus as 'ready' | 'quarantined',
    };

  } catch (err) {
    // Mark source as failed — it stays in 'processing' so we know it's incomplete
    await supabase.from('events').insert({
      event_type: 'system_error',
      actor: 'system',
      source_id: source.id,
      payload: { error: String(err), stage: 'ingestion' },
    });
    throw err;
  }
}
