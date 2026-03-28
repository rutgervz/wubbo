import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: text, input_type: 'query' }),
  })
  const data = await res.json()
  return data.data[0].embedding
}

export async function POST(request: Request) {
  try {
    const { query, personId, sourceType } = await request.json()

    if (!query || query.length < 2) {
      return Response.json({ results: [] })
    }

    const embedding = await getEmbedding(query)
    const supabase = createServiceClient()

    // Hybrid search via RPC
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: `[${embedding.join(',')}]`,
      match_count: 15,
      ...(personId ? { filter_person_id: personId } : {}),
    })

    if (error) {
      // Fallback to semantic-only search
      const { data: fallback, error: fbErr } = await supabase.rpc('search_chunks_with_context', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.3,
        match_count: 15,
      })

      if (fbErr) throw fbErr

      // Dedupe and format
      const seen = new Map<string, any>()
      for (const chunk of (fallback || [])) {
        if (!seen.has(chunk.source_id) || chunk.similarity > seen.get(chunk.source_id).similarity) {
          seen.set(chunk.source_id, chunk)
        }
      }

      const results = Array.from(seen.values()).map(c => ({
        source_id: c.source_id,
        title: c.source_title,
        source_type: c.source_type,
        person_name: c.person_name,
        source_date: c.source_date,
        snippet: c.content?.substring(0, 150) || '',
        score: c.similarity,
      }))

      return Response.json({ results })
    }

    return Response.json({ results: data || [] })
  } catch (err) {
    console.error('Search API error:', err)
    return Response.json({ error: 'Zoeken mislukt' }, { status: 500 })
  }
}
