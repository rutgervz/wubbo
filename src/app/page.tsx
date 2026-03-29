'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import LoginScreen from '@/components/LoginScreen'
import ChatPanel from '@/components/ChatPanel'
import SourceDetail from '@/components/SourceDetail'
import { createBrowserClient } from '@/lib/supabase'
import type { GraphData } from '@/components/KnowledgeGraph'

const KnowledgeGraph = dynamic(
  () => import('@/components/KnowledgeGraph'),
  { ssr: false, loading: () => <div style={{ flex: 1, background: 'radial-gradient(ellipse at center, #0E1418 0%, #08080A 70%)' }} /> }
)

// ---------- Design tokens ----------
const C = {
  bg: '#0A0A08',
  surface: '#111110',
  surfaceHover: '#161614',
  ink: '#E8E4DC', inkSoft: '#C4BFB4', inkMu: '#7A766C', inkGhost: '#3A3835',
  sea: '#5ABFBF', seaSoft: 'rgba(90,191,191,0.1)',
  coral: '#E8795D', coralSoft: 'rgba(232,121,93,0.1)',
  line: 'rgba(255,255,255,0.06)',
  lineMed: 'rgba(255,255,255,0.1)',
}
const F = {
  display: "'Instrument Serif', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// ---------- Types ----------
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
  article: '📰', bookmark: '🔖', note: '📝', email: '✉',
}

function fmtDate(d: string): string {
  try {
    const dt = new Date(d)
    const m = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
    return `${dt.getDate()} ${m[dt.getMonth()]}`
  } catch { return '' }
}

// ---------- Left panel source row ----------
function SourceRow({ item, onOpen }: { item: StreamSource; onOpen: (id: string) => void }) {
  const color = item.person_color || C.sea
  const isYT = item.source_type === 'youtube'
  return (
    <div
      onClick={() => onOpen(item.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s', border: `0.5px solid transparent` }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = C.line }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
    >
      <span style={{ fontSize: 12, flexShrink: 0 }}>
        {isYT ? <span style={{ color: '#FF4444', fontSize: 10 }}>▶</span> : TYPE_ICONS[item.source_type] || '📄'}
      </span>
      <span style={{ fontSize: 12, color: C.inkSoft, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span style={{ fontSize: 10, color: C.inkGhost, flexShrink: 0, fontFamily: F.mono }}>{fmtDate(item.source_date || item.created_at)}</span>
    </div>
  )
}

// ---------- Stream card (left panel list) ----------
function StreamCard({ item, onOpen }: { item: StreamSource; onOpen: (id: string) => void }) {
  const color = item.person_color || C.sea
  const personSoft = item.person_name === 'Annelie' ? C.coralSoft : C.seaSoft
  const personColor = item.person_name === 'Annelie' ? C.coral : C.sea
  return (
    <div
      onClick={() => onOpen(item.id)}
      style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `0.5px solid ${C.line}`, background: C.surface, transition: 'all 0.15s', marginBottom: 6 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = C.surfaceHover }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.surface }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: color, fontFamily: F.mono }}>{TYPE_ICONS[item.source_type] || '📄'} {item.source_type}</span>
        {item.person_name && (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: personSoft, color: personColor, fontWeight: 600 }}>
            {item.person_name}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.35, marginBottom: 4 }}>{item.title}</div>
      <div style={{ fontSize: 10, color: C.inkGhost, fontFamily: F.mono }}>{fmtDate(item.source_date || item.created_at)}</div>
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
          {item.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: C.inkMu }}>{t}</span>
          ))}
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

  const [leftTab, setLeftTab] = useState<'graph' | 'stream' | 'youtube'>('graph')
  const [graphPath, setGraphPath] = useState<string[]>(['__overview__'])
  const [graphFs, setGraphFs] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string>('')
  const [personFilter, setPersonFilter] = useState<'Rutger' | 'Annelie' | null>(null)

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  // Auth
  useEffect(() => {
    const sb = createBrowserClient()
    sb.auth.getSession().then(({ data: { session } }) => setAuthed(!!session))
  }, [])

  // Graph data
  useEffect(() => {
    if (!authed) return
    fetch('/api/graph').then(r => r.ok ? r.json() : null).then(d => { if (d) setGraphData(d) })
  }, [authed])

  // Sources
  useEffect(() => {
    if (!authed) return
    setLoadingSources(true)
    fetch('/api/sources')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSources(d.sources || []) })
      .finally(() => setLoadingSources(false))
  }, [authed])

  const handleLogout = useCallback(async () => {
    await createBrowserClient().auth.signOut()
    setAuthed(false)
  }, [])

  const handleGraphClick = useCallback((nodeId: string, breadcrumbIdx?: number) => {
    if (nodeId === 'Rutger' || nodeId === 'Annelie') {
      setPersonFilter(prev => prev === nodeId ? null : nodeId as 'Rutger' | 'Annelie')
      return
    }
    if (breadcrumbIdx !== undefined) {
      setGraphPath(prev => prev.slice(0, breadcrumbIdx + 1))
      setSelectedNode(graphPath[breadcrumbIdx] === '__overview__' ? '' : graphPath[breadcrumbIdx])
    } else {
      setGraphPath(prev => prev[prev.length - 1] === nodeId ? prev : [...prev, nodeId])
      setSelectedNode(nodeId)
    }
  }, [graphPath])

  // Sources linked to selected node (by tag or title match)
  const nodeSources = useMemo(() => {
    if (!selectedNode || selectedNode === '__overview__') return []
    const q = selectedNode.toLowerCase()
    return sources.filter(s =>
      s.tags.some(t => t.toLowerCase() === q) ||
      s.title.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [sources, selectedNode])

  // YouTube sources for tab
  const youtubeSources = useMemo(() =>
    sources.filter(s => s.source_type === 'youtube'), [sources])

  // Stats for header
  const edgeCount = graphData?.edges?.length ?? 0
  const sourceCount = sources.length

  if (authed === null) return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.sea, animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const graphCenter = graphPath[graphPath.length - 1]

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: F.body, color: C.ink, overflow: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <header style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0 22px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontFamily: F.display, fontStyle: 'italic', fontWeight: 400 }}>Wubbo</span>
          <span style={{ fontSize: 11, color: C.ink, opacity: 0.3, fontFamily: F.mono }}>
            {sourceCount} bronnen · {edgeCount} verbanden
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Person avatars */}
          {([{ name: 'Rutger', color: C.sea, l: 'R' }, { name: 'Annelie', color: C.coral, l: 'A' }] as const).map((p, i) => (
            <div key={p.name}
              onClick={() => setPersonFilter(prev => prev === p.name ? null : p.name)}
              title={p.name}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: p.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#0A0A08',
                cursor: 'pointer',
                opacity: personFilter && personFilter !== p.name ? 0.35 : 1,
                border: personFilter === p.name ? `2px solid ${C.ink}` : `2px solid ${C.bg}`,
                transition: 'all 0.15s',
                marginLeft: i > 0 ? -4 : 0,
              }}
            >{p.l}</div>
          ))}
          <button onClick={handleLogout}
            style={{ fontSize: 11, fontFamily: F.body, padding: '4px 11px', borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.inkGhost, cursor: 'pointer', marginLeft: 4, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = C.coral; e.currentTarget.style.borderColor = C.coral }}
            onMouseLeave={e => { e.currentTarget.style.color = C.inkGhost; e.currentTarget.style.borderColor = C.line }}
          >Uit</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel (38%) ── */}
        <div style={{ width: '38%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.line}`, overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            {([['graph', 'Graph'], ['stream', 'Stream'], ['youtube', 'YouTube']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setLeftTab(id)}
                style={{
                  flex: 1, height: 38, fontSize: 12, fontFamily: F.body, fontWeight: leftTab === id ? 600 : 400,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: leftTab === id ? C.ink : C.inkMu,
                  borderBottom: `2px solid ${leftTab === id ? C.sea : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: leftTab === 'graph' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Graph tab */}
            {leftTab === 'graph' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                {graphData ? (
                  <KnowledgeGraph
                    data={graphData}
                    centerId={graphCenter}
                    path={graphPath}
                    fullscreen={graphFs}
                    onNodeClick={handleGraphClick}
                    onToggleFullscreen={() => setGraphFs(f => !f)}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkGhost, fontSize: 13 }}>
                    Graph laden...
                  </div>
                )}
              </div>
            )}

            {/* Stream tab */}
            {leftTab === 'stream' && (
              <div style={{ flex: 1, padding: '12px 12px 20px', overflow: 'auto' }}>
                {loadingSources ? (
                  <div style={{ padding: 24, textAlign: 'center', color: C.inkGhost, fontSize: 13 }}>Laden...</div>
                ) : sources.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: C.inkGhost, fontSize: 13 }}>Nog geen bronnen</div>
                ) : (
                  (personFilter ? sources.filter(s => s.person_name === personFilter) : sources).map(s => (
                    <StreamCard key={s.id} item={s} onOpen={setSelectedSourceId} />
                  ))
                )}
              </div>
            )}

            {/* YouTube tab */}
            {leftTab === 'youtube' && (
              <div style={{ flex: 1, padding: '12px 12px 20px', overflow: 'auto' }}>
                {youtubeSources.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: C.inkGhost, fontSize: 13, lineHeight: 1.6 }}>
                    Nog geen video's.<br />Plak een YouTube URL in het werkpaneel.
                  </div>
                ) : (
                  youtubeSources.map(s => (
                    <StreamCard key={s.id} item={s} onOpen={setSelectedSourceId} />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Context section — geselecteerde node */}
          {selectedNode && selectedNode !== '__overview__' && leftTab === 'graph' && (
            <div style={{ borderTop: `1px solid ${C.line}`, flexShrink: 0, maxHeight: 220, overflow: 'auto' }}>
              <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontFamily: F.mono, color: C.sea, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  GESELECTEERD: {selectedNode}
                </span>
                <button onClick={() => setSelectedNode('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkGhost, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              {nodeSources.length === 0 ? (
                <div style={{ padding: '6px 14px 12px', fontSize: 12, color: C.inkGhost }}>Geen gekoppelde bronnen</div>
              ) : (
                <div style={{ padding: '2px 4px 8px' }}>
                  {nodeSources.map(s => (
                    <SourceRow key={s.id} item={s} onOpen={setSelectedSourceId} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel (62%) — Claude work panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ChatPanel
            graphContext={selectedNode || undefined}
            onSourceSelect={setSelectedSourceId}
            personName={personFilter || 'Rutger'}
          />
        </div>
      </div>

      {/* Source detail slide-over */}
      <SourceDetail sourceId={selectedSourceId} onClose={() => setSelectedSourceId(null)} />
    </div>
  )
}
