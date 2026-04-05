// YouTube ingestion pipeline
// Strategy: IOS innertube (best XML format) → ANDROID innertube → fallback to client_transcript
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

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)));
}

function parseTranscriptXml(xml: string): string {
  const lines: string[] = [];

  // Format 1 (IOS returns this): <text start="0" dur="4.29">content</text>
  const tRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let tm;
  while ((tm = tRegex.exec(xml)) !== null) {
    const clean = decodeEntities(tm[1]).replace(/\n/g, ' ').trim();
    if (clean) lines.push(clean);
  }

  // Format 3 (ANDROID returns this): <p t="0" d="4290"><s>word</s><s>word</s></p>
  if (lines.length === 0) {
    const pRegex = /<p\s+t="\d+"[^>]*>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pRegex.exec(xml)) !== null) {
      const words: string[] = [];
      const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
      let sm;
      while ((sm = sRegex.exec(pm[1])) !== null) {
        const w = decodeEntities(sm[1]).trim();
        if (w) words.push(w);
      }
      if (words.length > 0) {
        lines.push(words.join(' '));
      } else {
        // Fallback: strip tags, take raw text
        const raw = pm[1].replace(/<[^>]+>/g, '');
        const clean = decodeEntities(raw).replace(/\n/g, ' ').trim();
        if (clean) lines.push(clean);
      }
    }
  }

  return lines.join(' ');
}

interface InnertubeClient {
  name: string;
  clientName: string;
  clientVersion: string;
  userAgent: string;
}

const INNERTUBE_CLIENTS: InnertubeClient[] = [
  {
    name: 'IOS',
    clientName: 'IOS',
    clientVersion: '20.10.38',
    userAgent: 'com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)',
  },
  {
    name: 'ANDROID',
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
  },
];

async function fetchTranscriptViaInnertube(videoId: string, client: InnertubeClient): Promise<{ text: string; error?: string }> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': client.userAgent,
    },
    body: JSON.stringify({
      context: { client: { clientName: client.clientName, clientVersion: client.clientVersion } },
      videoId,
    }),
  });
  if (!res.ok) return { text: '', error: `${client.name}: HTTP ${res.status}` };

  const data = await res.json();
  const playability = data?.playabilityStatus?.status;
  if (playability !== 'OK') {
    return { text: '', error: `${client.name}: ${playability || 'unknown status'}` };
  }

  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    return { text: '', error: `${client.name}: geen caption tracks` };
  }

  const track = tracks.find((t: any) => t.languageCode === 'nl')
    || tracks.find((t: any) => t.languageCode === 'en')
    || tracks[0];
  if (!track?.baseUrl) return { text: '', error: `${client.name}: geen baseUrl` };

  const xmlRes = await fetch(track.baseUrl, {
    headers: { 'User-Agent': client.userAgent },
  });
  if (!xmlRes.ok) return { text: '', error: `${client.name}: XML HTTP ${xmlRes.status}` };

  const xml = await xmlRes.text();
  if (!xml || xml.length < 20) return { text: '', error: `${client.name}: XML leeg (${xml.length}b)` };

  const text = parseTranscriptXml(xml);
  if (!text) return { text: '', error: `${client.name}: XML parsing mislukt` };

  return { text };
}

async function fetchTranscript(videoId: string): Promise<{ text: string; error?: string; method?: string }> {
  const errors: string[] = [];

  // Try each innertube client
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const result = await fetchTranscriptViaInnertube(videoId, client);
      if (result.text && result.text.length > 50) {
        return { text: result.text, method: client.name };
      }
      if (result.error) errors.push(result.error);
    } catch (e: any) {
      errors.push(`${client.name}: ${e.message}`);
    }
  }

  return { text: '', error: errors.join(' | ') };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, person_name, client_transcript } = body;
    if (!url) return Response.json({ error: 'url is verplicht' }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return Response.json({ error: 'Ongeldige YouTube URL' }, { status: 400 });

    const meta = await fetchMetadata(videoId);

    // Use client-provided transcript if available, else try server-side
    let transcript = '';
    let transcriptError = '';
    let transcriptMethod = '';

    if (typeof client_transcript === 'string' && client_transcript.length > 50) {
      transcript = client_transcript;
      transcriptMethod = 'client';
    } else {
      const result = await fetchTranscript(videoId);
      transcript = result.text;
      transcriptError = result.error || '';
      transcriptMethod = result.method || '';
    }

    const hasTranscript = transcript.length > 100;

    const content = [
      `Kanaal: ${meta.channel}`,
      `URL: https://www.youtube.com/watch?v=${videoId}`,
      meta.thumbnail ? `Thumbnail: ${meta.thumbnail}` : null,
      '',
      hasTranscript
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
      // Use _t suffix when we have transcript, to re-ingest over a previous no-transcript version
      externalId: hasTranscript ? `youtube_${videoId}_t` : `youtube_${videoId}`,
      ingestedVia: 'youtube_panel',
    });

    return Response.json({
      success: true,
      title: meta.title,
      channel: meta.channel,
      thumbnail: meta.thumbnail,
      video_id: videoId,
      has_transcript: hasTranscript,
      transcript_method: transcriptMethod || null,
      transcript_error: transcriptError || null,
      // Signal to client: if no transcript, offer paste option
      needs_client_transcript: !hasTranscript && !client_transcript,
      source_id: result.sourceId,
      chunks_created: result.chunksCreated,
      status: result.status,
    });
  } catch (err) {
    console.error('YouTube route error:', err);
    return Response.json({ error: 'Verwerking mislukt', details: String(err) }, { status: 500 });
  }
}
