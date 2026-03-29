'use client'

import { useState, useCallback } from 'react'

const C = {
  bg: '#08080A', bgWarm: '#111113', surface: '#16161A',
  ink: '#E8E4DC', inkSoft: '#C4BFB4', inkMu: '#7A766C', inkGhost: '#3A3835',
  sea: '#5ABFBF', seaSoft: '#122828', coral: '#E8795D', coralSoft: '#2A1A14',
  green: '#6AAF7A', greenSoft: '#141E17', line: '#2A2825',
}

interface IngestResult {
  title: string
  status: 'ok' | 'duplicate' | 'error'
  chunks?: number
  tags?: string[]
  error?: string
}

export default function IngestPage() {
  const [mode, setMode] = useState<'manual' | 'claude_export'>('manual')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [person, setPerson] = useState<'Rutger' | 'Annelie'>('Rutger')
  const [sourceType, setSourceType] = useState('note')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<IngestResult[]>([])
  const [progress, setProgress] = useState('')

  const token = 'wubbo-tothemoon-2026'

  const ingestOne = async (item: { title: string; content: string; source_type: string; person_name: string; url?: string; source_date?: string }) => {
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(item),
    })
    const data = await res.json()
    if (!res.ok) return { title: item.title, status: 'error' as const, error: data.error || data.details }
    if (data.status === 'duplicate') return { title: item.title, status: 'duplicate' as const }
    return { title: item.title, status: 'ok' as const, chunks: data.chunks_created, tags: data.tags }
  }

  const handleManual = async () => {
    if (!title.trim() || !content.trim()) return
    setLoading(true)
    const result = await ingestOne({ title, content, source_type: sourceType, person_name: person, url: url || undefined })
    setResults(prev => [result, ...prev])
    if (result.status === 'ok') { setTitle(''); setContent(''); setUrl('') }
    setLoading(false)
  }

  const handleClaudeExport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResults([])

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Claude export format: array of conversations
      const conversations = Array.isArray(data) ? data : (data.conversations || [])
      setProgress(`${conversations.length} gesprekken gevonden...`)

      const newResults: IngestResult[] = []
      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i]
        const convTitle = conv.name || conv.title || `Claude gesprek ${i + 1}`
        setProgress(`${i + 1} / ${conversations.length}: ${convTitle.slice(0, 40)}...`)

        // Extract text from messages
        let convContent = ''
        const messages = conv.chat_messages || conv.messages || []
        for (const msg of messages) {
          const role = msg.sender === 'human' ? 'Mens' : msg.sender === 'assistant' ? 'Claude' : (msg.role === 'user' ? 'Mens' : 'Claude')
          const text = Array.isArray(msg.content)
            ? msg.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
            : (msg.content || msg.text || '')
          if (text.trim()) convContent += `${role}: ${text}\n\n`
        }

        if (!convContent.trim() || convContent.length < 50) continue

        const sourceDate = conv.created_at ? conv.created_at.slice(0, 10) : undefined
        const result = await ingestOne({
          title: convTitle,
          content: convContent.trim(),
          source_type: 'claude_chat',
          person_name: person,
          source_date: sourceDate,
        })
        newResults.push(result)
        setResults([...newResults])

        // Rate limiting: kleine pauze om Voyage AI niet te overbelasten
        if (i < conversations.length - 1) await new Promise(r => setTimeout(r, 300))
      }

      setProgress(`Klaar! ${newResults.filter(r => r.status === 'ok').length} nieuw, ${newResults.filter(r => r.status === 'duplicate').length} duplicaten.`)
    } catch (err) {
      setProgress(`Fout bij verwerken: ${String(err)}`)
    }
    setLoading(false)
  }, [person])

  const ok = results.filter(r => r.status === 'ok').length
  const dup = results.filter(r => r.status === 'duplicate').length
  const err = results.filter(r => r.status === 'error').length

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '40px 24px', fontFamily: "'DM Sans', system-ui, sans-serif", color: C.ink }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 13, color: C.inkMu, textDecoration: 'none' }}>← Wubbo</a>
          <h1 style={{ fontSize: 22, fontWeight: 400, margin: 0, fontStyle: 'italic', fontFamily: "'Instrument Serif', Georgia, serif" }}>Ingest</h1>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.bgWarm, borderRadius: 10, padding: 4, border: `1px solid ${C.line}` }}>
          {([['manual', 'Handmatig'], ['claude_export', 'Claude export (.json)']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              style={{ flex: 1, padding: '8px 0', fontSize: 13, fontFamily: 'inherit', fontWeight: mode === id ? 600 : 400, background: mode === id ? C.surface : 'transparent', color: mode === id ? C.ink : C.inkMu, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Person selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['Rutger', 'Annelie'] as const).map(p => (
            <button key={p} onClick={() => setPerson(p)}
              style={{ padding: '7px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, border: `1px solid ${person === p ? (p === 'Rutger' ? C.sea : C.coral) : C.line}`, borderRadius: 8, cursor: 'pointer', background: person === p ? (p === 'Rutger' ? C.seaSoft : C.coralSoft) : 'transparent', color: person === p ? (p === 'Rutger' ? C.sea : C.coral) : C.inkMu, transition: 'all 0.15s' }}>
              {p}
            </button>
          ))}
        </div>

        {/* Manual mode */}
        {mode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel"
                style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', background: C.bgWarm, border: `1px solid ${C.line}`, borderRadius: 10, outline: 'none', color: C.ink }}
                onFocus={e => e.target.style.borderColor = C.sea} onBlur={e => e.target.style.borderColor = C.line} />
              <select value={sourceType} onChange={e => setSourceType(e.target.value)}
                style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', background: C.bgWarm, border: `1px solid ${C.line}`, borderRadius: 10, outline: 'none', color: C.ink, cursor: 'pointer' }}>
                {['note','article','document','claude_chat','podcast','youtube','bookmark'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (optioneel)"
              style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', background: C.bgWarm, border: `1px solid ${C.line}`, borderRadius: 10, outline: 'none', color: C.ink }}
              onFocus={e => e.target.style.borderColor = C.sea} onBlur={e => e.target.style.borderColor = C.line} />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Plak hier de inhoud..."
              rows={10}
              style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'inherit', background: C.bgWarm, border: `1px solid ${C.line}`, borderRadius: 10, outline: 'none', color: C.ink, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = C.sea} onBlur={e => e.target.style.borderColor = C.line} />
            <button onClick={handleManual} disabled={loading || !title.trim() || !content.trim()}
              style={{ padding: '12px 0', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, background: loading ? C.seaSoft : C.sea, color: loading ? C.sea : '#0A0A0A', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s' }}>
              {loading ? 'Verwerken...' : 'Ingest →'}
            </button>
          </div>
        )}

        {/* Claude export mode */}
        {mode === 'claude_export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '16px', background: C.bgWarm, borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
              <strong style={{ color: C.ink }}>Hoe exporteer je Claude gesprekken:</strong><br />
              1. Ga naar claude.ai → Instellingen → Account<br />
              2. Klik "Export data" → download het ZIP-bestand<br />
              3. Pak het uit en upload hieronder <code style={{ color: C.sea }}>conversations.json</code>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 24px', background: C.bgWarm, border: `2px dashed ${C.line}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.sea; e.currentTarget.style.background = C.seaSoft }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.bgWarm }}>
              <span style={{ fontSize: 32 }}>📂</span>
              <span style={{ fontSize: 14, color: C.inkSoft }}>Klik om conversations.json te selecteren</span>
              <input type="file" accept=".json" onChange={handleClaudeExport} disabled={loading} style={{ display: 'none' }} />
            </label>
            {loading && progress && (
              <div style={{ padding: '12px 16px', background: C.seaSoft, borderRadius: 10, fontSize: 13, color: C.sea }}>
                {progress}
              </div>
            )}
            {!loading && progress && (
              <div style={{ padding: '12px 16px', background: C.greenSoft, borderRadius: 10, fontSize: 13, color: C.green }}>
                ✓ {progress}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: C.green }}>✓ {ok} nieuw</span>
              <span style={{ color: C.inkMu }}>⟳ {dup} duplicaat</span>
              {err > 0 && <span style={{ color: C.coral }}>✗ {err} fout</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
              {results.map((r, i) => (
                <div key={i} style={{ padding: '8px 12px', background: C.surface, borderRadius: 8, border: `0.5px solid ${r.status === 'ok' ? C.green + '44' : r.status === 'error' ? C.coral + '44' : C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: r.status === 'ok' ? C.green : r.status === 'error' ? C.coral : C.inkGhost, flexShrink: 0 }}>
                    {r.status === 'ok' ? '✓' : r.status === 'duplicate' ? '⟳' : '✗'}
                  </span>
                  <span style={{ fontSize: 12, color: C.inkSoft, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  {r.status === 'ok' && r.chunks !== undefined && (
                    <span style={{ fontSize: 11, color: C.inkGhost, flexShrink: 0 }}>{r.chunks} chunks</span>
                  )}
                  {r.status === 'error' && r.error && (
                    <span style={{ fontSize: 10, color: C.coral, flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
