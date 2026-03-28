import { NextResponse } from 'next/server';
import { ingest, type IngestInput } from '@/lib/ingestion';

export const runtime = 'edge';

export async function POST(request: Request) {
  // Validate webhook secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Input validation
    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    }

    if (body.content.length < 10) {
      return NextResponse.json({ error: 'content too short (min 10 chars)' }, { status: 400 });
    }

    const input: IngestInput = {
      title: body.title,
      content: body.content,
      sourceType: body.source_type || 'note',
      personName: body.person || body.who || 'Samen',
      ownerId: body.owner_id,
      originalUrl: body.url,
      externalId: body.external_id,
      ingestedVia: body.ingested_via || 'webhook',
      addedByAgent: body.added_by_agent,
      confidenceScore: body.confidence_score,
      sourceDate: body.source_date,
    };

    const result = await ingest(input);

    return NextResponse.json({
      success: true,
      source_id: result.sourceId,
      chunks_created: result.chunksCreated,
      tags: result.tagsApplied,
      status: result.status,
    });

  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: 'Ingestion failed', details: String(error) },
      { status: 500 }
    );
  }
}
