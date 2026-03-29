// YouTube ingestion pipeline
// Uses nodejs runtime (youtube-transcript uses fetch internally, but safer with Node)
export const runtime = 'nodejs';

import { ingest } from '@/lib/ingestion';

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

async function fetchMetadata(videoId: string): Promise<{ title: string; channel: string; thumbnail: string; duration?: string }> {
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
    // Fetch video page to find caption tracks
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    const html = await pageRes.text();

    // Extract ytInitialPlayerResponse
    // Use indexOf + substring instead of /s flag (es2018 not guaranteed in tsconfig)
    const marker = 'ytInitialPlayerResponse = ';
    const start = html.indexOf(marker);
    if (start === -1) return '';
    const jsonStart = start + marker.length;
    // Find matching closing brace
    let depth = 0, end = -1;
    for (let j = jsonStart; j < Math.min(jsonStart + 200000, html.length); j++) {
      if (html[j] === '{') depth++;
      else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    const match = end > jsonStart ? [null, html.slice(jsonStart, end)] : null;
    if (!match) return '';

    let playerData: any;
    try { playerData = JSON.parse(match[1] as string); } catch { return ''; }

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return '';

    // Prefer Dutch (nl), fall back to English (en), then first available
    const track =
      tracks.find((t: any) => t.languageCode === 'nl') ||
      tracks.find((t: any) => t.languageCode === 'en') ||
      tracks[0];

    if (!track?.baseUrl) return '';

    // Fetch XML transcript
    const xmlRes = await fetch(track.baseUrl + '&fmt=json3');
    if (!xmlRes.ok) return '';

    const data = await xmlRes.json();
    const events = data?.events || [];
    const lines: string[] = [];

    for (const ev of events) {
      if (!ev.segs) continue;
      const text = ev.segs.map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
      if (text) lines.push(text);
    }

    return lines.join(' ');
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
