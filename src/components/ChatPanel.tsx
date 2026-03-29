'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ---------- Types ----------
interface SourceRef { id: string; title: string; type: string }
interface MessageMeta { sourceCount?: number; sources?: SourceRef[] }
interface Message { role: 'user' | 'assistant'; content: string; meta?: MessageMeta }

// ---------- Design tokens ----------
const C = {
  bg: '#0A0A08',
  ink: '#E8E4DC', inkSoft: '#C4BFB4', inkMu: '#7A766C', inkGhost: '#3A3835',
  sea: '#5ABFBF', seaSoft: 'rgba(90,191,191,0.08)',
  coral: '#E8795D',
  line: 'rgba(255,255,255,0.06)',
}
const F = { body: "'DM Sans', system-ui, sans-serif", mono: "'JetBrains Mono', monospace" }

const TYPE_ICONS: Record<string, string> = {
  youtube: '▶', note: '📝', document: '📄', claude_chat: '💬',
  article: '📰', bookmark: '🔖', podcast: '🎙',
}

function isYouTubeUrl(text: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/.test(text.trim())
}

function parseTranscriptXml(xml: string): string {
  const de = (s: string) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'")
  const lines: string[] = []
  // Format 1: <p><s>word</s></p>
  const pRe = /<p\s+t="\d+"[^>]*>([\s\S]*?)<\/p>/g
  let pm
  while ((pm = pRe.exec(xml)) !== null) {
    const words: string[] = []
    const sRe = /<s[^>]*>([^<]*)<\/s>/g
    let sm
    while ((sm = sRe.exec(pm[1])) !== null) { const w = de(sm[1]).trim(); if (w) words.push(w) }
    if (words.length > 0) lines.push(words.join(' '))
    else { const raw = de(pm[1].replace(/<[^>]+>/g, '')).replace(/\n/g, ' ').trim(); if (raw) lines.push(raw) }
  }
  // Format 2: <text>content</text>
  if (lines.length === 0) {
    const tRe = /<text[^>]*>([\s\S]*?)<\/text>/g
    let tm
    while ((tm = tRe.exec(xml)) !== null) { const c = de(tm[1]).replace(/\n/g, ' ').trim(); if (c) lines.push(c) }
  }
  return lines.join(' ')
}

// ---------- Component ----------
export default function ChatPanel({
  graphContext,
  onSourceSelect,
  personName = 'Rutger',
}: {
  graphContext?: string
  onSourceSelect?: (id: string) => void
  personName?: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-grow textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Fetch transcript CLIENT-SIDE (browser is not IP-blocked by YouTube)
  const fetchTranscriptClientSide = useCallback(async (videoId: string): Promise<string> => {
    try {
      // Use innertube API from the browser — no CORS issues since it's YouTube→YouTube
      // We go through our own proxy to avoid CORS: but actually that defeats the purpose.
      // Instead, use a public transcript API or parse from the YouTube page via a CORS proxy.

      // Approach: fetch via YouTube's timedtext endpoint through our server as a simple proxy
      const res = await fetch(`/api/youtube/transcript?v=${videoId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.transcript) return data.transcript
      }
    } catch {}

    // Fallback: fetch the innertube API directly from the browser
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20240313.05.00' } },
          videoId,
        }),
      })
      if (!res.ok) return ''
      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (!tracks || tracks.length === 0) return ''
      const track = tracks.find((t: any) => t.languageCode === 'nl')
        || tracks.find((t: any) => t.languageCode === 'en')
        || tracks[0]
      if (!track?.baseUrl) return ''

      const xmlRes = await fetch(track.baseUrl)
      if (!xmlRes.ok) return ''
      const xml = await xmlRes.text()
      return parseTranscriptXml(xml)
    } catch (e) {
      console.log('Client-side transcript failed:', e)
      return ''
    }
  }, [])

  const handleYouTube = useCallback(async (url: string) => {
    const userMsg: Message = { role: 'user', content: url }
    const loadingMsg: Message = { role: 'assistant', content: 'Video ophalen...' }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setStreaming(true)

    try {
      // Extract video ID
      const vidMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
      const videoId = vidMatch?.[1] || ''

      // Try to fetch transcript from the browser first
      let transcript = ''
      if (videoId) {
        setMessages(prev => { const u = [...prev]; u[u.length - 1].content = 'Transcript ophalen...'; return [...u] })
        transcript = await fetchTranscriptClientSide(videoId)
      }

      // Send URL + transcript to server for ingestion
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, person_name: personName, client_transcript: transcript || undefined }),
      })
      const data = await res.json()
      const hasTranscript = data.has_transcript || (transcript.length > 100)
      const text = data.success
        ? `Video opgeslagen ✓\n\n**${data.title}**\nKanaal: ${data.channel}\n${hasTranscript ? `Transcript: ${data.chunks_created} chunks` : 'Geen transcript beschikbaar'}\n\nVraag maar wat je wilt weten over deze video.`
        : `Kon video niet verwerken: ${data.error || 'onbekende fout'}`
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1].content = text
        return u
      })
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1].content = 'Fout bij ophalen video. Probeer opnieuw.'
        return u
      })
    }
    setStreaming(false)
  }, [personName, fetchTranscriptClientSide])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return

    if (!overrideText) setInput('')

    // YouTube detection
    if (isYouTubeUrl(text) && !overrideText) {
      handleYouTube(text)
      return
    }

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role === 'assistant' ? 'claude' : m.role,
            text: m.content,
          })),
          graphContext,
        }),
      })
      if (!res.ok) throw new Error('Chat mislukt')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Geen stream')
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'context') {
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1].meta = { sourceCount: parsed.sourceCount, sources: parsed.sources }
                return [...u]
              })
            } else if (parsed.text) {
              setMessages(prev => {
                const u = [...prev]
                const last = u[u.length - 1]
                if (last?.role === 'assistant') last.content += parsed.text
                return [...u]
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const u = [...prev]
        const last = u[u.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          last.content = 'Er ging iets mis. Probeer het opnieuw.'
        }
        return u
      })
    }
    setStreaming(false)
  }, [input, messages, streaming, graphContext, handleYouTube])

  const saveAsSource = async (msg: Message, idx: number) => {
    if (savedIdx.has(idx)) return
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer wubbo-tothemoon-2026' },
        body: JSON.stringify({
          title: `Claude antwoord — ${new Date().toLocaleDateString('nl-NL')}${graphContext ? ` · ${graphContext}` : ''}`,
          content: msg.content,
          source_type: 'note',
          person_name: personName,
        }),
      })
      if (res.ok) setSavedIdx(prev => new Set([...prev, idx]))
    } catch {}
  }

  const exportText = (msg: Message) => {
    const blob = new Blob([msg.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wubbo-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const makeShorter = () => {
    sendMessage('Maak bovenstaand antwoord korter, maximaal 3 kernzinnen.')
  }

  const suggestions = graphContext
    ? [`Wat is ${graphContext}?`, `Hoe past ${graphContext} in het grotere geheel?`, `Welke bronnen gaan over ${graphContext}?`]
    : ['Wat is Re-Creation?', 'Wat speelt er rond Florida?', 'Hoe verbindt alles zich?']

  const looksLikeYT = isYouTubeUrl(input)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: C.bg }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, minHeight: 200 }}>
            {graphContext && (
              <div style={{ fontSize: 11, fontFamily: F.mono, color: C.sea, opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                CONTEXT: {graphContext}
              </div>
            )}
            <div style={{ fontSize: 13, color: C.inkGhost, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
              Stel een vraag, plak een YouTube URL, of typ een thema om te verkennen.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 460 }}>
              {suggestions.map(s => (
                <button key={s}
                  onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 0) }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(90,191,191,0.18)', background: 'rgba(90,191,191,0.05)', color: 'rgba(90,191,191,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: F.body, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,191,191,0.12)'; e.currentTarget.style.color = C.sea; e.currentTarget.style.borderColor = 'rgba(90,191,191,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(90,191,191,0.05)'; e.currentTarget.style.color = 'rgba(90,191,191,0.6)'; e.currentTarget.style.borderColor = 'rgba(90,191,191,0.18)' }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>

            {/* Bubble */}
            <div style={{
              maxWidth: m.role === 'user' ? '72%' : '88%',
              padding: '12px 16px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? 'rgba(90,191,191,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${m.role === 'user' ? 'rgba(90,191,191,0.2)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              {/* Context line */}
              {m.role === 'assistant' && m.meta && (
                <div style={{ fontSize: 10, color: C.ink, opacity: 0.28, marginBottom: 8, fontFamily: F.mono, letterSpacing: '0.05em' }}>
                  CONTEXT: {m.meta.sourceCount ?? 0} {(m.meta.sourceCount ?? 0) === 1 ? 'bron' : 'bronnen'} uit Wubbo
                  {m.meta.sources && m.meta.sources.length > 0 && (
                    <> · {m.meta.sources.slice(0, 3).map(s => s.title.split(/[\s—–]/)[0]).join(', ')}</>
                  )}
                </div>
              )}

              {/* Content */}
              <div style={{ fontSize: 14, lineHeight: 1.65, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.content || (streaming && i === messages.length - 1 ? '' : '…')}
                {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                  <span style={{ color: C.sea, opacity: 0.7 }}>▊</span>
                )}
              </div>

              {/* Source tags */}
              {m.role === 'assistant' && m.meta?.sources && m.meta.sources.length > 0 && m.content && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {m.meta.sources.map(s => (
                    <button key={s.id}
                      onClick={() => onSourceSelect?.(s.id)}
                      style={{ fontSize: 10, padding: '2px 9px', borderRadius: 10, border: '1px solid rgba(90,191,191,0.18)', background: 'rgba(90,191,191,0.06)', color: C.sea, cursor: 'pointer', fontFamily: F.body, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,191,191,0.14)'; e.currentTarget.style.borderColor = 'rgba(90,191,191,0.35)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(90,191,191,0.06)'; e.currentTarget.style.borderColor = 'rgba(90,191,191,0.18)' }}
                    >
                      {TYPE_ICONS[s.type] || '📄'} {s.title.length > 32 ? s.title.slice(0, 30) + '…' : s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {m.role === 'assistant' && m.content && !streaming && (
              <div style={{ display: 'flex', gap: 5, opacity: 0.4, transition: 'opacity 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.4' }}>
                {([
                  { label: savedIdx.has(i) ? '✓ Opgeslagen' : 'Sla op als bron', action: () => saveAsSource(m, i) },
                  { label: 'Maak korter', action: makeShorter },
                  { label: 'Exporteer', action: () => exportText(m) },
                ] as const).map(btn => (
                  <button key={btn.label} onClick={btn.action as () => void}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: C.inkMu, cursor: 'pointer', fontFamily: F.body, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.inkSoft; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.inkMu; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >{btn.label}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 20px 18px', borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={looksLikeYT ? '▶ YouTube video — Stuur om te importeren' : 'Vraag Wubbo iets, plak een URL, of upload...'}
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${looksLikeYT ? 'rgba(232,121,93,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12,
            padding: '10px 14px',
            color: C.ink,
            fontSize: 13,
            resize: 'none',
            outline: 'none',
            fontFamily: F.body,
            lineHeight: 1.5,
            overflowY: 'hidden',
            transition: 'border-color 0.2s',
          }}
          disabled={streaming}
        />
        <button
          onClick={() => sendMessage()}
          disabled={streaming || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: input.trim() && !streaming ? C.sea : 'rgba(90,191,191,0.1)',
            border: 'none',
            color: input.trim() && !streaming ? '#0A0A08' : C.sea,
            fontSize: 16, fontWeight: 700,
            cursor: input.trim() && !streaming ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >→</button>
      </div>
    </div>
  )
}
