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

function extractVideoId(url: string): string {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m?.[1] || ''
}

// ---------- Transcript Paste Modal ----------
function TranscriptPasteModal({ videoTitle, onSubmit, onSkip }: {
  videoTitle: string
  onSubmit: (text: string) => void
  onSkip: () => void
}) {
  const [text, setText] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(232,121,93,0.3)`, borderRadius: 14, padding: '16px 18px', marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.coral, fontWeight: 600, marginBottom: 8 }}>
        Transcript niet beschikbaar via server
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 12 }}>
        YouTube blokkeert transcripts vanuit cloud servers. Je kunt het handmatig toevoegen:
      </div>
      <ol style={{ fontSize: 11, color: C.inkMu, lineHeight: 1.7, margin: '0 0 12px', paddingLeft: 18, fontFamily: F.body }}>
        <li>Open de video op YouTube</li>
        <li>Klik op <strong style={{ color: C.inkSoft }}>···</strong> (meer) onder de video</li>
        <li>Kies <strong style={{ color: C.inkSoft }}>Transcript tonen</strong></li>
        <li>Selecteer alles (Ctrl/Cmd+A) en kopieer</li>
        <li>Plak hieronder</li>
      </ol>
      <textarea
        ref={textRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Plak het transcript hier..."
        style={{
          width: '100%', minHeight: 80, maxHeight: 180, padding: '10px 12px',
          background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.line}`, borderRadius: 8,
          color: C.ink, fontSize: 12, fontFamily: F.body, resize: 'vertical', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={() => { if (text.trim().length > 20) onSubmit(text.trim()) }}
          disabled={text.trim().length < 20}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: text.trim().length > 20 ? 'pointer' : 'default',
            background: text.trim().length > 20 ? C.sea : 'rgba(90,191,191,0.15)',
            color: text.trim().length > 20 ? '#0A0A08' : 'rgba(90,191,191,0.4)',
            fontFamily: F.body, transition: 'all 0.2s',
          }}
        >Opslaan met transcript</button>
        <button
          onClick={onSkip}
          style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'transparent',
            color: C.inkMu, fontSize: 12, cursor: 'pointer', fontFamily: F.body,
          }}
        >Overslaan</button>
      </div>
    </div>
  )
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
  const [pendingYT, setPendingYT] = useState<{ url: string; title: string; videoId: string } | null>(null)
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

  const updateLastMessage = useCallback((content: string) => {
    setMessages(prev => {
      const u = [...prev]
      if (u.length > 0) u[u.length - 1] = { ...u[u.length - 1], content }
      return u
    })
  }, [])

  const handleYouTube = useCallback(async (url: string) => {
    const videoId = extractVideoId(url)
    const userMsg: Message = { role: 'user', content: url }
    const loadingMsg: Message = { role: 'assistant', content: '▶ Video ophalen...' }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setStreaming(true)

    try {
      // Step 1: Send to server (tries IOS + ANDROID innertube)
      updateLastMessage('▶ Video verwerken — transcript ophalen via server...')
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, person_name: personName }),
      })
      const data = await res.json()

      if (!data.success) {
        updateLastMessage(`Kon video niet verwerken: ${data.error || 'onbekende fout'}`)
        setStreaming(false)
        return
      }

      if (data.has_transcript) {
        // Server got the transcript — done!
        updateLastMessage(
          `**${data.title}**\nKanaal: ${data.channel}\n\n✓ Transcript opgeslagen (${data.chunks_created} chunks, via ${data.transcript_method || 'server'})\n\nVraag maar wat je wilt weten over deze video.`
        )
        setStreaming(false)
        return
      }

      // Step 2: Server failed to get transcript — show paste UI
      updateLastMessage(
        `**${data.title}**\nKanaal: ${data.channel}\n\n⚠ Video opgeslagen maar zonder transcript.\n${data.transcript_error ? `Reden: ${data.transcript_error}` : ''}`
      )
      setPendingYT({ url, title: data.title, videoId })
      setStreaming(false)

    } catch (e) {
      updateLastMessage('Fout bij ophalen video. Probeer opnieuw.')
      setStreaming(false)
    }
  }, [personName, updateLastMessage])

  const handleTranscriptPaste = useCallback(async (transcript: string) => {
    if (!pendingYT) return
    setStreaming(true)
    setPendingYT(null)

    setMessages(prev => [...prev, { role: 'assistant', content: 'Transcript verwerken...' }])

    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: pendingYT.url,
          person_name: personName,
          client_transcript: transcript,
        }),
      })
      const data = await res.json()

      if (data.success && data.has_transcript) {
        updateLastMessage(
          `✓ Transcript opgeslagen! (${data.chunks_created} chunks)\n\nVraag maar wat je wilt weten over "${pendingYT.title}".`
        )
      } else {
        updateLastMessage('Transcript kon niet verwerkt worden. Probeer het opnieuw met een langer fragment.')
      }
    } catch {
      updateLastMessage('Fout bij verwerken transcript.')
    }
    setStreaming(false)
  }, [pendingYT, personName, updateLastMessage])

  const handleTranscriptSkip = useCallback(() => {
    setPendingYT(null)
  }, [])

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

            {/* Transcript paste modal — shown after the last message if needed */}
            {i === messages.length - 1 && pendingYT && !streaming && (
              <TranscriptPasteModal
                videoTitle={pendingYT.title}
                onSubmit={handleTranscriptPaste}
                onSkip={handleTranscriptSkip}
              />
            )}

            {/* Action buttons */}
            {m.role === 'assistant' && m.content && !streaming && !pendingYT && (
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
