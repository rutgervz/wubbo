import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { query } = await request.json();
  const debug: any = { query, steps: [] };

  try {
    // Step 1: Get embedding
    debug.steps.push('getting embedding...');
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ model: 'voyage-3-lite', input: query, input_type: 'query' }),
    });

    if (!res.ok) {
      debug.embedding_error = await res.text();
      return NextResponse.json(debug);
    }

    const data = await res.json();
    const embedding = data.data[0].embedding;
    debug.steps.push(`embedding ok: ${embedding.length} dimensions`);

    // Step 2: Search Supabase
    debug.steps.push('searching supabase...');
    debug.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING';
    debug.service_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';

    const searchRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/search_chunks_with_context`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({
          query_embedding: `[${embedding.join(',')}]`,
          match_threshold: 0.0,
          match_count: 5,
        }),
      }
    );

    debug.search_status = searchRes.status;
    const searchData = await searchRes.text();

    if (!searchRes.ok) {
      debug.search_error = searchData;
      return NextResponse.json(debug);
    }

    const chunks = JSON.parse(searchData);
    debug.steps.push(`found ${chunks.length} chunks`);
    debug.results = chunks.map((c: any) => ({
      title: c.source_title,
      similarity: c.similarity,
      content_preview: c.content?.substring(0, 100),
    }));

  } catch (err) {
    debug.error = String(err);
  }

  return NextResponse.json(debug, { status: 200 });
}
