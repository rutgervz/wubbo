import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Simple in-memory cache (per-instance, resets on cold start)
const cache = new Map<string, { embedding: number[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 200;

function cleanCache() {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now - val.ts > CACHE_TTL_MS) cache.delete(key);
  }
  // Evict oldest if over limit
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < oldest.length - MAX_CACHE_SIZE; i++) {
      cache.delete(oldest[i][0]);
    }
  }
}

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  // Check cache
  const cacheKey = text.trim().toLowerCase().substring(0, 500);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ embedding: cached.embedding, cached: true });
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: text, input_type: 'query' }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Embedding failed: ${response.status}` }, { status: 500 });
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;

  // Store in cache
  cache.set(cacheKey, { embedding, ts: Date.now() });
  cleanCache();

  return NextResponse.json({ embedding });
}
