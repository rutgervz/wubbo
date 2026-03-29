// YouTube ingestion pipeline
export const runtime = 'nodejs';

import { ingest } from '@/lib/ingestion';
import { fetchTranscript as fetchYTTranscript } from 'youtube-transcript-plus';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchMetadata(videoId: string): Promise<{ title: string; channel: string; thumbnail: string }> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();
    return {
      title: data.title || `YouTube video ${videoId}`,
      channel: data.author_name || 'Onbekend kanaal',
      thumbnail: data.thumbnail_url || '',
    };
  } catch {
    return { title: `YouTube video ${videoId}`, channel: 'Onbekend kanaal', thumbnail: '' };
  }
}

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    // youtube-transcript-plus uses innertube ANDROID API internally
    const segments = await fetchYTTranscript(videoId);
    if (!segments || !Array.isArray(segments) || segments.length === 0) return '';
    return segments.map((s: { text: string }) => s.text).join(' ');
  } catch (e) {
    console.error('Transcript fetch error:', e);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, person_name, client_transcript } = body;
    if (!url) return Response.json({ error: 'url is verplicht' }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return Response.json({ error: 'Ongeldige YouTube URL' }, { status: 400 });

    const meta = await fetchMetadata(videoId);

    // Use client-provided transcript if available, else fetch server-side
    let transcript = '';
    if (typeof client_transcript === 'string' && client_transcript.length > 50) {
      transcript = client_transcript;
    } else {
      transcript = await fetchTranscript(videoId);
    }

    const content = [
      `Kanaal: ${meta.channel}`,
      `URL: https://www.youtube.com/watch?v=${videoId}`,
      meta.thumbnail ? `Thumbnail: ${meta.thumbnail}` : null,
      '',
      transcript
        ? `Transcript:\n${transcript}`
        : '(Geen transcript beschikbaar voor deze video)',
    ].filter(Boolean).join('\n');

    const PERSON_OWNER_MAP: Record<string, string> = {
      'Rutger': process.env.RUTGER_USER_ID || '12a4211a-91fb-4a72-8cb0-74f92692fced',
      'Annelie': process.env.ANNELIE_USER_ID || process.env.RUTGER_USER_ID || '12a4211a-91fb-4a72-8cb0-74f92692fced',
    };
    const personName = person_name || 'Rutger';
    const ownerId = PERSON_OWNER_MAP[personName] || PERSON_OWNER_MAP['Rutger'];

    const result = await ingest({
      title: meta.title,
      content,
      sourceType: 'youtube',
      personName,
      ownerId,
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      // Append timestamp if we have transcript, so it doesn't deduplicate against
      // a previous version that was ingested without transcript
      externalId: transcript.length > 100 ? `youtube_${videoId}_t` : `youtube_${videoId}`,
      ingestedVia: 'youtube_panel',
    });

    return Response.json({
      success: true,
      title: meta.title,
      channel: meta.channel,
      thumbnail: meta.thumbnail,
      video_id: videoId,
      has_transcript: transcript.length > 100,
      source_id: result.sourceId,
      chunks_created: result.chunksCreated,
      status: result.status,
    });
  } catch (err) {
    console.error('YouTube route error:', err);
    return Response.json({ error: 'Verwerking mislukt', details: String(err) }, { status: 500 });
  }
}
