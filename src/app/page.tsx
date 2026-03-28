'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import LoginScreen from '@/components/LoginScreen'
import SearchBar from '@/components/SearchBar'
import StreamView from '@/components/StreamView'
import ChatPanel from '@/components/ChatPanel'
import { createBrowserClient } from '@/lib/supabase'

const KnowledgeGraph = dynamic(() => import('@/components/KnowledgeGraph'), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <div className="pulse" />
    </div>
  ),
})

type View = 'graph' | 'stream'

interface GraphData {
  nodes: Array<{
    id: string
    label: string
    color: string | null
    node_type: string | null
    source_count: number
  }>
  edges: Array<{
    id: string
    from_node_id: string
    to_node_id: string
    strength: number
    is_confirmed: boolean
  }>
  persons: Array<{
    id: string
    name: string
    color: string
  }>
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking
  const [view, setView] = useState<View>('graph')
  const [data, setData] = useState<GraphData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null)

  // Check existing session
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })
  }, [])

  // Fetch graph data after auth
  useEffect(() => {
    if (!authed) return
    fetch('/api/graph')
      .then(res => {
        if (!res.ok) throw new Error('Graph data ophalen mislukt')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
  }, [authed])

  const handleLogin = useCallback(() => setAuthed(true), [])

  // Auth check loading
  if (authed === null) {
    return (
      <div className="loading-screen">
        <div className="pulse" />
      </div>
    )
  }

  // Not authenticated
  if (!authed) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#000',
        color: '#E8795D',
        fontFamily: 'monospace',
        fontSize: '14px',
      }}>
        {error}
      </div>
    )
  }

  // Loading graph
  if (!data) {
    return (
      <div className="loading-screen">
        <div className="pulse" />
      </div>
    )
  }

  return (
    <>
      {/* View toggle */}
      <ViewToggle view={view} onToggle={setView} />

      {/* Search bar */}
      <SearchBar />

      {/* Graph (default view) */}
      {view === 'graph' && (
        <KnowledgeGraph
          data={data}
          onNodeSelect={(label: string | null) => setSelectedNodeLabel(label)}
        />
      )}

      {/* Stream view */}
      <StreamView visible={view === 'stream'} />

      {/* Chat panel */}
      <ChatPanel graphContext={selectedNodeLabel || undefined} />
    </>
  )
}

// ---------- View Toggle ----------

function ViewToggle({ view, onToggle }: { view: View; onToggle: (v: View) => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 44,
      zIndex: 70,
      display: 'flex',
      gap: 2,
      background: 'rgba(8,12,20,0.7)',
      borderRadius: 10,
      padding: 3,
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {(['graph', 'stream'] as View[]).map(v => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: view === v ? '#fff' : 'rgba(255,255,255,0.3)',
            background: view === v ? 'rgba(90,191,191,0.2)' : 'transparent',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          {v === 'graph' ? 'Graph' : 'Stream'}
        </button>
      ))}
    </div>
  )
}
