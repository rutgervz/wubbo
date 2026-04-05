export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('v') || 'XCjeiW9NqPE';
  const results: Record<string, any> = {};

  const clients = [
    { name: 'ANDROID', ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)', clientName: 'ANDROID', clientVersion: '20.10.38' },
    { name: 'IOS', ua: 'com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)', clientName: 'IOS', clientVersion: '20.10.38' },
    { name: 'WEB', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', clientName: 'WEB', clientVersion: '2.20240313.05.00' },
    { name: 'MWEB', ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', clientName: 'MWEB', clientVersion: '2.20240313.05.00' },
  ];

  for (const c of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua },
        body: JSON.stringify({
          context: { client: { clientName: c.clientName, clientVersion: c.clientVersion } },
          videoId,
        }),
      });
      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      results[c.name] = {
        status: res.status,
        playability: data?.playabilityStatus?.status,
        tracks: tracks?.length || 0,
        trackLangs: tracks?.map((t: any) => t.languageCode) || [],
      };

      // If tracks found, try fetching actual XML
      if (tracks?.[0]?.baseUrl) {
        const xmlRes = await fetch(tracks[0].baseUrl, { headers: { 'User-Agent': c.ua } });
        const xml = await xmlRes.text();
        results[c.name].xmlLength = xml.length;
        results[c.name].xmlStart = xml.substring(0, 100);

        // Try parsing
        if (xml.length > 0) {
          let lineCount = 0;
          const pRe = new RegExp('<p\\s[^>]*>([\\s\\S]*?)</p>', 'g');
          let pm;
          while ((pm = pRe.exec(xml)) !== null) {
            const sRe = /<s[^>]*>([^<]*)<\/s>/g;
            let hasWord = false;
            let sm;
            while ((sm = sRe.exec(pm[1])) !== null) { if (sm[1].trim()) hasWord = true; }
            if (hasWord) lineCount++;
          }
          if (lineCount === 0) {
            const tRe = new RegExp('<text[^>]*>([\\s\\S]*?)</text>', 'g');
            let tm;
            while ((tm = tRe.exec(xml)) !== null) { if (tm[1].trim()) lineCount++; }
          }
          results[c.name].parsedLines = lineCount;
        }
      }
    } catch (e: any) {
      results[c.name] = { error: e.message };
    }
  }

  // Also test watch page
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+678',
      },
    });
    const html = await pageRes.text();
    results.watchPage = {
      length: html.length,
      hasCaptionTracks: html.includes('captionTracks'),
      hasRecaptcha: html.includes('class="g-recaptcha"'),
    };
  } catch (e: any) {
    results.watchPage = { error: e.message };
  }

  return Response.json({ videoId, results });
}
