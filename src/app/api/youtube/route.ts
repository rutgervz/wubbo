// YouTube ingestion pipeline — direct implementation without external packages
// Uses watch page HTML → extract captionTracks → fetch transcript XML
export const runtime = 'nodejs';

import { ingest } from '@/lib/ingestion';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

  // Format 3 (newer): <p t="0" d="4290"><s>people</s><s>who</s></p>
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
      const raw = pm[1].replace(/<[^>]+>/g, '');
      const clean = decodeEntities(raw).replace(/\n/g, ' ').trim();
      if (clean) lines.push(clean);
    }
  }

  // Format 1 (older): <text start="0" dur="4.29">content</text>
  if (lines.length === 0) {
    const tRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let tm;
    while ((tm = tRegex.exec(xml)) !== null) {
      const clean = decodeEntities(tm[1]).replace(/\n/g, ' ').trim();
      if (clean) lines.push(clean);
    }
  }

  return lines.join(' ');
}

function extractPlayerResponse(html: string): any {
  // Try 'var ytInitialPlayerResponse = {...};'
  const marker = 'var ytInitialPlayerResponse = ';
  let start = html.indexOf(marker);
  if (start === -1) {
    // Also try without 'var '
    const marker2 = 'ytInitialPlayerResponse = ';
    start = html.indexOf(marker2);
    if (start !== -1) start += marker2.length;
  } else {
    start += marker.length;
  }
  if (start <= 0) return null;

  let depth = 0, end = -1;
  for (let i = start; i < Math.min(start + 500000, html.length); i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end <= start) return null;

  try { return JSON.parse(html.slice(start, end)); }
  catch { return null; }
}

async function fetchTranscript(videoId: string): Promise<{ text: string; error?: string }> {
  try {
    // Step 1: Fetch the YouTube watch page
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!pageRes.ok) {
      return { text: '', error: `Watch page HTTP ${pageRes.status}` };
    }
    const html = await pageRes.text();

    if (html.includes('class="g-recaptcha"')) {
      return { text: '', error: 'YouTube CAPTCHA — te veel requests' };
    }

    // Step 2: Extract player response from page HTML
    const playerData = extractPlayerResponse(html);
    if (!playerData) {
      return { text: '', error: 'Kon ytInitialPlayerResponse niet vinden in pagina' };
    }

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      // Try innertube ANDROID as fallback
      return await fetchTranscriptViaInnertube(videoId);
    }

    // Step 3: Pick best track (nl > en > first)
    const track =
      tracks.find((t: any) => t.languageCode === 'nl') ||
      tracks.find((t: any) => t.languageCode === 'en') ||
      tracks[0];
    if (!track?.baseUrl) {
      return { text: '', error: 'Geen baseUrl in caption track' };
    }

    // Step 4: Fetch transcript XML (same IP session, so signature valid)
    const xmlRes = await fetch(track.baseUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.7',
      },
    });
    if (!xmlRes.ok) {
      return { text: '', error: `Transcript XML HTTP ${xmlRes.status}` };
    }
    const xml = await xmlRes.text();
    if (!xml || xml.length < 20) {
      return { text: '', error: `Transcript XML leeg (${xml.length} bytes)` };
    }

    // Step 5: Parse
    const text = parseTranscriptXml(xml);
    if (!text) {
      return { text: '', error: 'Kon transcript XML niet parsen' };
    }
    return { text };

  } catch (e: any) {
    return { text: '', error: `Onverwachte fout: ${e?.message || String(e)}` };
  }
}

// Fallback: try innertube ANDROID API (works from residential IPs)
async function fetchTranscriptViaInnertube(videoId: string): Promise<{ text: string; error?: string }> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    });
    if (!res.ok) return { text: '', error: `Innertube HTTP ${res.status}` };

    const data = await res.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      return { text: '', error: 'Innertube: geen caption tracks' };
    }

    const track = tracks.find((t: any) => t.languageCode === 'nl')
      || tracks.find((t: any) => t.languageCode === 'en')
      || tracks[0];
    if (!track?.baseUrl) return { text: '', error: 'Innertube: geen baseUrl' };

    const xmlRes = await fetch(track.baseUrl, {
      headers: { 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
    });
    if (!xmlRes.ok) return { text: '', error: `Innertube transcript HTTP ${xmlRes.status}` };
    const xml = await xmlRes.text();
    if (!xml || xml.length < 20) return { text: '', error: 'Innertube transcript leeg' };

    return { text: parseTranscriptXml(xml) || '' };
  } catch (e: any) {
    return { text: '', error: `Innertube fout: ${e?.message || String(e)}` };
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
    let transcriptError = '';
    if (typeof client_transcript === 'string' && client_transcript.length > 50) {
      transcript = client_transcript;
    } else {
      const result = await fetchTranscript(videoId);
      transcript = result.text;
      transcriptError = result.error || '';
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
      transcript_error: transcriptError || null,
      source_id: result.sourceId,
      chunks_created: result.chunksCreated,
      status: result.status,
    });
  } catch (err) {
    console.error('YouTube route error:', err);
    return Response.json({ error: 'Verwerking mislukt', details: String(err) }, { status: 500 });
  }
}
