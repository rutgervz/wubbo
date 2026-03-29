'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import LoginScreen from '@/components/LoginScreen'
import ChatPanel from '@/components/ChatPanel'
import SourceDetail from '@/components/SourceDetail'
import { createBrowserClient } from '@/lib/supabase'
import type { GraphData } from '@/components/KnowledgeGraph'

const KnowledgeGraph = dynamic(() => import('@/components/KnowledgeGraph'), { ssr: false, loading: () => <div style={{ height: 420, background: 'radial-gradient(ellipse at center, #0E1418 0%, #08080A 70%)', borderRadius: 14 }} /> })

// ---------- Design tokens ----------
const C = {
  bg: '#08080A', bgWarm: '#111113', bgDeep: '#1A1A1E',
  surface: '#16161A', surfaceHover: '#1E1E24',
  ink: '#E8E4DC', inkSoft: '#C4BFB4', inkMu: '#7A766C', inkGhost: '#3A3835',
  sea: '#5ABFBF', seaLt: '#6DD4D4', seaSoft: '#122828', seaDeep: '#3D9E9E',
  coral: '#E8795D', coralSoft: '#2A1A14',
  dune: '#D4B98A',
  purple: '#9B8DD6',
  green: '#6AAF7A',
  storm: '#8A9AB0',
  line: '#2A2825',
}
const F = {
  display: "'Instrument Serif', 'Playfair Display', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// ---------- Source types ----------
interface StreamSource {
  id: string
  title: string
  source_type: string
  summary: string | null
  source_date: string | null
  created_at: string
  person_name: string | null
  person_color: string | null
  tags: string[]
}

const TYPE_ICONS: Record<string, string> = {
  claude_chat: '💬', youtube: '▶', podcast: '🎙', document: '📄',
  article: '📰', bookmark: '🔖', note: '📝', email: '✉', voice_memo: '🎤', social: '🌐',
}
const TYPE_LABEL: Record<string, string> = {
  claude_chat: 'Chat', youtube: 'Video', podcast: 'Podcast', document: 'Document',
  article: 'Artikel', bookmark: 'Bookmark', note: 'Notitie',
}

function fmtDate(d: string): string {
  try {
    const dt = new Date(d)
    const m = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
    return `${dt.getDate()} ${m[dt.getMonth()]}`
  } catch { return d }
}

// ---------- Stream card ----------
function StreamCard({ item, onAskClaude, onTagClick, onPersonClick, onOpen }: {
  item: StreamSource
  onAskClaude: (ctx: string) => void
  onTagClick: (tag: string) => void
  onPersonClick: (p: string) => void
  onOpen: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const personColor = item.person_color || C.sea
  const personSoft = item.person_name === 'Annelie' ? C.coralSoft : C.seaSoft
  const typeColor = personColor

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{ background: C.surface, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', border: `0.5px solid ${C.line}`, transition: 'all 0.25s', position: 'relative', overflow: 'hidden', breakInside: 'avoid', marginBottom: 12 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = typeColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${typeColor}11` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: typeColor, borderRadius: '14px 0 0 14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: F.mono, color: typeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {TYPE_ICONS[item.source_type] || '📦'} {TYPE_LABEL[item.source_type] || item.source_type}
        </span>
        {item.person_name && (
          <span
            onClick={e => { e.stopPropagation(); onPersonClick(item.person_name!) }}
            style={{ fontSize: 10, fontFamily: F.body, fontWeight: 600, padding: '2px 8px', borderRadius: 8, cursor: 'pointer', background: personSoft, color: personColor }}
          >{item.person_name}</span>
        )}
      </div>
      <h3 style={{ fontSize: 14, fontFamily: F.body, fontWeight: 500, color: C.ink, margin: '0 0 6px', lineHeight: 1.35 }}>{item.title}</h3>
      <div style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body }}>{fmtDate(item.source_date || item.created_at)}</div>
      {item.summary && (expanded) && (
        <p style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.body, lineHeight: 1.6, margin: '10px 0 0' }}>{item.summary}</p>
      )}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          {item.tags.map(t => (
            <span key={t} onClick={e => { e.stopPropagation(); onTagClick(t) }}
              style={{ fontSize: 10, fontFamily: F.body, color: C.inkMu, background: C.bgDeep, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = typeColor}
              onMouseLeave={e => e.currentTarget.style.color = C.inkMu}>{t}</span>
          ))}
        </div>
      )}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); onOpen(item.id) }}
            style={{ flex: 1, padding: '8px 0', fontSize: 12, fontFamily: F.body, fontWeight: 500, background: C.bgDeep, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 8, cursor: 'pointer' }}>
            Lees volledig →
          </button>
          <button onClick={e => { e.stopPropagation(); onAskClaude(item.title) }}
            style={{ flex: 1, padding: '8px 0', fontSize: 12, fontFamily: F.body, fontWeight: 500, background: C.sea, color: '#0A0A0A', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Bespreek met Claude →
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Main app ----------
export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [sources, setSources] = useState<StreamSource[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  const [view, setView] = useState<'graph' | 'stream'>('graph')
  const [graphPath, setGraphPath] = useState<string[]>(['__overview__'])
  const [graphFs, setGraphFs] = useState(false)
  const [filter, setFilter] = useState('')
  const [personFilter, setPersonFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudeCtx, setClaudeCtx] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const graphCenter = graphPath[graphPath.length - 1]

  // Auth check
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => setAuthed(!!session))
  }, [])

  // Fetch graph data
  useEffect(() => {
    if (!authed) return
    fetch('/api/graph').then(r => r.ok ? r.json() : null).then(d => { if (d) setGraphData(d) })
  }, [authed])

  // Fetch sources
  useEffect(() => {
    if (!authed) return
    setLoadingSources(true)
    fetch('/api/sources').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSources(d.sources || []) })
      .finally(() => setLoadingSources(false))
  }, [authed])

  const handleLogin = useCallback(() => setAuthed(true), [])

  const handleLogout = useCallback(async () => {
    await createBrowserClient().auth.signOut()
    setAuthed(false)
  }, [])

  const openClaude = useCallback((ctx: string) => {
    setClaudeCtx(ctx)
    setClaudeOpen(true)
  }, [])

  const applyFilter = useCallback((f: string) => setFilter(f), [])
  const applyPerson = useCallback((p: string) => setPersonFilter(prev => prev === p ? null : p), [])

  const handleGraphClick = useCallback((nodeId: string, breadcrumbIdx?: number) => {
    if (nodeId === 'Rutger' || nodeId === 'Annelie') {
      applyPerson(nodeId); return
    }
    if (breadcrumbIdx !== undefined) {
      setGraphPath(prev => prev.slice(0, breadcrumbIdx + 1))
      const target = graphPath[breadcrumbIdx]
      if (target === '__overview__') setFilter('')
      else setFilter(target)
    } else {
      setGraphPath(prev => prev[prev.length - 1] === nodeId ? prev : [...prev, nodeId])
      setFilter(nodeId)
    }
  }, [graphPath, applyPerson])

  // Word cloud from graph nodes (top 14 by source_count)
  const wordCloud = useMemo(() => {
    if (!graphData) return []
    const sorted = [...graphData.nodes].sort((a, b) => b.source_count - a.source_count).slice(0, 14)
    const max = sorted[0]?.source_count || 1
    return sorted.map(n => ({ text: n.label, w: 0.3 + (n.source_count / max) * 0.7, color: n.color || C.sea }))
  }, [graphData])

  // Filtered sources
  const filtered = useMemo(() => {
    let items = [...sources]
    if (personFilter) items = items.filter(i => i.person_name === personFilter)
    if (filter) {
      const q = filter.toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        (i.summary && i.summary.toLowerCase().includes(q)) ||
        (i.person_name && i.person_name.toLowerCase().includes(q))
      )
    }
    if (sort === 'newest') items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return items
  }, [sources, filter, personFilter, sort])

  if (authed === null) return <div style={{ background: C.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="pulse" /></div>
  if (!authed) return <LoginScreen onLogin={handleLogin} />

  return (
    <div style={{ fontFamily: F.body, background: C.bg, minHeight: '100vh', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.line}`, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontFamily: F.display, fontWeight: 400, margin: 0, fontStyle: 'italic', color: C.ink }}>Wubbo</h1>
          <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.mono }}>{filtered.length} / {sources.length}</span>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 340, position: 'relative' }}>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Zoek op titel, tag, inhoud..."
            style={{ width: '100%', padding: '9px 14px 9px 34px', fontSize: 13, fontFamily: F.body, background: C.bgWarm, border: '1px solid transparent', borderRadius: 10, outline: 'none', color: C.ink, boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = C.sea} onBlur={e => e.target.style.borderColor = 'transparent'} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.inkGhost }}>⌕</span>
          {filter && <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.inkMu }}>×</button>}
        </div>

        {/* Person avatars + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex' }}>
            {[{ name: 'Rutger', color: C.sea, letter: 'R' }, { name: 'Annelie', color: C.coral, letter: 'A' }].map((p, i) => (
              <div key={p.name} onClick={() => applyPerson(p.name)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0A0A0A', border: `2px solid ${personFilter === p.name ? C.ink : C.bg}`, cursor: 'pointer', marginLeft: i > 0 ? -6 : 0, zIndex: i > 0 ? 0 : 1 }}>
                {p.letter}
              </div>
            ))}
          </div>
          <button onClick={handleLogout}
            style={{ fontSize: 11, fontFamily: F.body, padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.inkMu, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = C.coral; e.currentTarget.style.borderColor = C.coral }}
            onMouseLeave={e => { e.currentTarget.style.color = C.inkMu; e.currentTarget.style.borderColor = C.line }}>
            Uit
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 55px)' }}>
        {/* Sidebar */}
        <div style={{ width: 210, padding: '16px 14px 16px 22px', borderRight: `1px solid ${C.line}`, flexShrink: 0, overflowY: 'auto' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.bgWarm, borderRadius: 8, padding: 3 }}>
            {(['graph', 'stream'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontFamily: F.body, fontWeight: view === v ? 600 : 400, background: view === v ? C.surface : 'transparent', color: view === v ? C.ink : C.inkMu, border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {v === 'graph' ? 'Graph' : 'Stream'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sorteren</div>
            {([{ id: 'newest', label: 'Nieuwste eerst' }, { id: 'oldest', label: 'Oudste eerst' }] as const).map(s => (
              <div key={s.id} onClick={() => setSort(s.id)} style={{ padding: '5px 10px', fontSize: 12, fontFamily: F.body, color: sort === s.id ? C.sea : C.inkMu, cursor: 'pointer', borderRadius: 6, background: sort === s.id ? C.seaSoft : 'transparent', marginBottom: 2, fontWeight: sort === s.id ? 600 : 400 }}>{s.label}</div>
            ))}
          </div>

          {/* Person filter */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Persoon</div>
            {[{ name: 'Rutger', color: C.sea, soft: C.seaSoft }, { name: 'Annelie', color: C.coral, soft: C.coralSoft }].map(p => (
              <div key={p.name} onClick={() => applyPerson(p.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 12, fontFamily: F.body, cursor: 'pointer', borderRadius: 6, marginBottom: 2, color: personFilter === p.name ? p.color : C.inkMu, background: personFilter === p.name ? p.soft : 'transparent', fontWeight: personFilter === p.name ? 600 : 400 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, boxShadow: `0 0 6px ${p.color}44` }} />
                {p.name}
                <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: F.mono, color: C.inkGhost }}>{sources.filter(s => s.person_name === p.name).length}</span>
              </div>
            ))}
          </div>

          {/* Word cloud (live from graph nodes) */}
          {wordCloud.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontFamily: F.mono, color: C.inkGhost, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Thema's</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', lineHeight: 1.7 }}>
                {wordCloud.map(w => (
                  <span key={w.text}
                    onClick={() => { applyFilter(w.text); if (view === 'graph') setGraphPath([w.text]) }}
                    style={{ fontSize: Math.round(10 + w.w * 9), fontFamily: F.body, fontWeight: w.w > 0.6 ? 500 : 400, color: filter.toLowerCase() === w.text.toLowerCase() ? C.ink : w.color, cursor: 'pointer', opacity: 0.5 + w.w * 0.5, transition: 'all 0.15s', textDecoration: filter.toLowerCase() === w.text.toLowerCase() ? 'underline' : 'none', textUnderlineOffset: 3 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = `${0.5 + w.w * 0.5}`}>
                    {w.text}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: '16px 28px 40px', minWidth: 0 }}>
          {/* Active filters bar */}
          {(filter || personFilter) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {personFilter && (
                <span style={{ fontSize: 11, fontFamily: F.body, color: personFilter === 'Rutger' ? C.sea : C.coral, background: personFilter === 'Rutger' ? C.seaSoft : C.coralSoft, padding: '3px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {personFilter}<span onClick={() => setPersonFilter(null)} style={{ cursor: 'pointer' }}>×</span>
                </span>
              )}
              {filter && (
                <span style={{ fontSize: 11, fontFamily: F.body, color: C.sea, background: C.seaSoft, padding: '3px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  "{filter}"<span onClick={() => setFilter('')} style={{ cursor: 'pointer' }}>×</span>
                </span>
              )}
              <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.mono }}>{filtered.length} resultaten</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => openClaude(filter || personFilter || '')}
                style={{ fontSize: 11, fontFamily: F.body, color: C.sea, background: C.seaSoft, border: 'none', padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Bespreek met Claude →
              </button>
            </div>
          )}

          {/* Graph view */}
          {view === 'graph' && graphData && (
            <div>
              <KnowledgeGraph
                data={graphData}
                centerId={graphCenter}
                path={graphPath}
                fullscreen={graphFs}
                onNodeClick={handleGraphClick}
                onToggleFullscreen={() => setGraphFs(f => !f)}
              />
              {filtered.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, color: C.inkMu, fontFamily: F.body, marginBottom: 10 }}>
                    {graphCenter === '__overview__' ? 'Recente bronnen' : <>Bronnen over <span style={{ fontWeight: 600, color: C.ink }}>{graphCenter}</span></>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {filtered.slice(0, 5).map(item => (
                      <div key={item.id}
                        onClick={() => setSelectedSourceId(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface, borderRadius: 8, border: `0.5px solid ${C.line}`, cursor: 'pointer', transition: 'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = item.person_color || C.sea; e.currentTarget.style.boxShadow = `0 0 12px ${item.person_color || C.sea}11` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = 'none' }}>
                        <span style={{ fontSize: 12 }}>{TYPE_ICONS[item.source_type] || '📦'}</span>
                        <span style={{ fontSize: 13, fontFamily: F.body, color: C.ink, flex: 1 }}>{item.title}</span>
                        {item.person_name && (
                          <span style={{ fontSize: 10, fontFamily: F.body, padding: '2px 6px', borderRadius: 6, background: item.person_name === 'Annelie' ? C.coralSoft : C.seaSoft, color: item.person_name === 'Annelie' ? C.coral : C.sea }}>{item.person_name}</span>
                        )}
                        <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body }}>{fmtDate(item.source_date || item.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!graphData && <div style={{ height: 420, background: C.bgWarm, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkGhost }}>Graph laden...</div>}
            </div>
          )}

          {/* Stream view */}
          {view === 'stream' && (
            <>
              {!filter && !personFilter && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontFamily: F.display, fontStyle: 'italic' }}>Stream</span>
                  <span style={{ fontSize: 11, color: C.inkGhost, fontFamily: F.body, marginLeft: 10 }}>{sort === 'newest' ? 'nieuwste eerst' : 'oudste eerst'}</span>
                </div>
              )}
              {loadingSources ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.inkGhost }}>Laden...</div>
              ) : filtered.length > 0 ? (
                <div style={{ columnCount: 2, columnGap: 12 }}>
                  {filtered.map(item => (
                    <StreamCard key={item.id} item={item}
                      onAskClaude={openClaude}
                      onTagClick={applyFilter}
                      onPersonClick={applyPerson}
                      onOpen={setSelectedSourceId}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.inkGhost }}>
                  <div style={{ fontSize: 24, fontFamily: F.display, fontStyle: 'italic', marginBottom: 8 }}>Niets gevonden</div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>Voeg bronnen toe via de ingest API</div>
                  <button onClick={() => openClaude(filter)}
                    style={{ padding: '10px 20px', fontSize: 13, background: C.sea, color: '#0A0A0A', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: F.body }}>
                    Vraag Claude →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Claude FAB */}
      {!claudeOpen && (
        <button onClick={() => openClaude('')}
          style={{ position: 'fixed', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 16, background: C.sea, color: '#0A0A0A', border: 'none', fontSize: 18, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 20px ${C.sea}44, 0 0 40px ${C.sea}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, transition: 'all 0.2s', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = `0 6px 28px ${C.sea}66` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 20px ${C.sea}44` }}>
          C
        </button>
      )}

      {/* Chat panel (real RAG streaming) */}
      {claudeOpen && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200 }}>
          <ChatPanel graphContext={claudeCtx || undefined} onClose={() => setClaudeOpen(false)} />
        </div>
      )}

      {/* Source detail */}
      <SourceDetail sourceId={selectedSourceId} onClose={() => setSelectedSourceId(null)} />
    </div>
  )
}
