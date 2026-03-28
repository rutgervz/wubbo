import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Server-side embedding for RAG
async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: text, input_type: 'query' }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

// Server-side RAG: search Supabase directly
async function fetchRAGContext(query: string): Promise<{ context: string; sourceCount: number }> {
  const embedding = await getEmbedding(query);

  // Call Supabase RPC directly
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/search_chunks_with_context`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.3,
        match_count: 12,
      }),
    }
  );

  if (!res.ok) {
    console.error('RAG search failed:', res.status, await res.text());
    return { context: '', sourceCount: 0 };
  }

  const chunks = await res.json();
  if (!chunks || chunks.length === 0) return { context: '', sourceCount: 0 };

  // Deduplicate by source_id
  const seen = new Map();
  for (const chunk of chunks) {
    if (!seen.has(chunk.source_id) || chunk.similarity > seen.get(chunk.source_id).similarity) {
      seen.set(chunk.source_id, chunk);
    }
  }

  const parts: string[] = [];
  for (const chunk of seen.values()) {
    let entry = `--- ${chunk.source_title} (${chunk.source_type}, ${chunk.person_name || '?'}, ${chunk.source_date || '?'}) ---\n`;
    if (chunk.context_before) entry += chunk.context_before.substring(0, 200) + '\n';
    entry += chunk.content;
    if (chunk.context_after) entry += '\n' + chunk.context_after.substring(0, 200);
    parts.push(entry);
  }

  return { context: parts.join('\n\n'), sourceCount: seen.size };
}

export async function POST(request: Request) {
  const { messages, graphContext } = await request.json();

  // Extract the last user message for RAG search
  const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
  const query = lastUserMessage?.text || lastUserMessage?.content || '';

  // Server-side RAG: search the knowledge base
  const rag = query ? await fetchRAGContext(query) : { context: '', sourceCount: 0 };

  // Build Wubbo system prompt
  let systemPrompt = `Je bent Wubbo, de kennisbank van Rutger en Annelie op Schiermonnikoog.
Vernoemd naar Wubbo Ockels — de eerste Nederlander in de ruimte, Groninger, natuur- en wiskundige, pionier van duurzaamheid, schepper van de Ecolution.
Je bewaart hun gezamenlijke kennis, legt verbanden, en helpt ze denken.
Verwijs naar specifieke bronnen waar relevant. Schrijf in het Nederlands tenzij anders gevraagd.
Toon: warm, direct, inhoudelijk — droog als het wad, scherp als de wind.
Gebruik nooit dash/hyphen bullets. Geef lively, scherpe antwoorden in de Jiskefet-traditie.`;

  if (rag.context) {
    systemPrompt += `\n\nRelevante context uit Wubbo (${rag.sourceCount} bronnen):\n${rag.context}\n\nGebruik bovenstaande context om de vraag te beantwoorden. Verwijs naar de bronnen bij naam.`;
  }

  if (graphContext) {
    systemPrompt += `\n\nDe gebruiker navigeert in de kennisgraaf bij: "${graphContext}".`;
  }

  // Stream response from Claude
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream: true,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role === 'claude' ? 'assistant' : m.role,
        content: m.text || m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  // Forward the SSE stream to the client
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) { controller.close(); return; }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
            }
            if (parsed.type === 'message_stop') {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            }
          } catch {}
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
