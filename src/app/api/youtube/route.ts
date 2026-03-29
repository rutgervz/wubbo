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

async function fetchTranscript(videoId: string): Promise<{ text: string; error?: string }> {
  // youtube-transcript uses innertube API (Android client) which bypasses session-bound URLs
  const attempts = [
    () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'nl' }),
    () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }),
    () => YoutubeTranscript.fetchTranscript(videoId),
  ];

  for (const attempt of attempts) {
    try {
      const segments = await attempt();
      if (segments && segments.length > 0) {
        const text = segments.map((s: { text: string }) => s.text).join(' ');
        if (text.length > 20) return { text };
      }
    } catch (e) {
      // Continue to next attempt
      console.log('Transcript attempt failed:', String(e));
    }
  }

  // Fallback: try fetching via raw innertube API directly
  try {
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
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
    if (innertubeRes.ok) {
      const playerData = await innertubeRes.json();
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        const track = tracks.find((t: any) => t.languageCode === 'nl')
          || tracks.find((t: any) => t.languageCode === 'en')
          || tracks[0];
        if (track?.baseUrl) {
          const xmlRes = await fetch(track.baseUrl, {
            headers: { 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
          });
          if (xmlRes.ok) {
            const xml = await xmlRes.text();
            const lines: string[] = [];
            const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
            let m;
            while ((m = regex.exec(xml)) !== null) {
              const text = m[1]
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
              if (text) lines.push(text);
            }
            if (lines.length > 0) return { text: lines.join(' ') };
          }
        }
      }
    }
  } catch (e) {
    console.log('Innertube fallback failed:', String(e));
  }

  return { text: '', error: 'Transcript ophalen mislukt na meerdere pogingen' };
}

export async function POST(request: Request) {
  try {
    const { url, person_name } = await request.json();
    if (!url) return Response.json({ error: 'url is verplicht' }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return Response.json({ error: 'Ongeldige YouTube URL' }, { status: 400 });

    // Fetch metadata and transcript in parallel
    const [meta, transcriptResult] = await Promise.all([
      fetchMetadata(videoId),
      fetchTranscript(videoId),
    ]);
    const transcript = transcriptResult.text;

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
      transcript_error: transcriptResult.error || null,
      source_id: result.sourceId,
      chunks_created: result.chunksCreated,
      status: result.status,
    });

  } catch (err) {
    console.error('YouTube route error:', err);
    return Response.json({ error: 'Verwerking mislukt', details: String(err) }, { status: 500 });
  }
}
