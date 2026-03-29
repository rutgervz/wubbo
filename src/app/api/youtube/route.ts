// YouTube ingestion pipeline
// Uses innertube API (via youtube-transcript) for reliable transcript access
export const runtime = 'nodejs';

import { ingest } from '@/lib/ingestion';
import { YoutubeTranscript } from 'youtube-transcript';

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
    // Try Dutch first, then English, then any language
    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'nl' });
    } catch {
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      } catch {
        segments = await YoutubeTranscript.fetchTranscript(videoId);
      }
    }

    if (!segments || segments.length === 0) return '';
    return segments.map((s: { text: string }) => s.text).join(' ');
  } catch (e) {
    console.error('Transcript fetch error:', e);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const { url, person_name } = await request.json();
    if (!url) return Response.json({ error: 'url is verplicht' }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return Response.json({ error: 'Ongeldige YouTube URL' }, { status: 400 });

    // Fetch metadata and transcript in parallel
    const [meta, transcript] = await Promise.all([
      fetchMetadata(videoId),
      fetchTranscript(videoId),
    ]);

    // Build content
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
      externalId: `youtube_${videoId}`,
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
