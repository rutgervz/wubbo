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

    // Map person_name → owner_id (Supabase auth user UUIDs)
    const PERSON_OWNER_MAP: Record<string, string> = {
      'Rutger': process.env.RUTGER_USER_ID || '12a4211a-91fb-4a72-8cb0-74f92692fced',
      'Annelie': process.env.ANNELIE_USER_ID || process.env.RUTGER_USER_ID || '12a4211a-91fb-4a72-8cb0-74f92692fced',
      'Samen': process.env.RUTGER_USER_ID || '12a4211a-91fb-4a72-8cb0-74f92692fced',
    };
    const personName = body.person_name || body.person || body.who || 'Rutger';
    const ownerId = body.owner_id || PERSON_OWNER_MAP[personName] || PERSON_OWNER_MAP['Rutger'];

    const input: IngestInput = {
      title: body.title,
      content: body.content,
      sourceType: body.source_type || 'note',
      personName,
      ownerId,
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
