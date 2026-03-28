'use client'

import { useState, useEffect } from 'react'

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
  claude_chat: '💬',
  youtube: '▶',
  podcast: '🎙',
  document: '📄',
  article: '📰',
  bookmark: '🔖',
  note: '📝',
  email: '✉',
  voice_memo: '🎤',
  social: '🌐',
}

export default function StreamView({ visible }: { visible: boolean }) {
  const [sources, setSources] = useState<StreamSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    fetch('/api/sources')
      .then(res => res.ok ? res.json() : Promise.reject('Ophalen mislukt'))
      .then(data => setSources(data.sources || []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false))
  }, [visible])

  if (!visible) return null

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Stream</h2>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          {sources.length} bron{sources.length !== 1 ? 'nen' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
          Laden...
        </div>
      ) : sources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
          Nog geen bronnen. Ingest iets via de API.
        </div>
      ) : (
        <div style={gridStyle}>
          {sources.map(source => (
            <div key={source.id} style={cardStyle}>
              {/* Type + Person badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{TYPE_ICONS[source.source_type] || '📦'}</span>
                {source.person_name && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: `${source.person_color || '#888'}22`,
                    color: source.person_color || '#888',
                    border: `1px solid ${source.person_color || '#888'}44`,
                  }}>
                    {source.person_name}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                  {source.source_type}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>
                {source.title}
              </div>

              {/* Summary */}
              {source.summary && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 8 }}>
                  {source.summary.length > 120 ? source.summary.slice(0, 120) + '...' : source.summary}
                </div>
              )}

              {/* Tags */}
              {source.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {source.tags.map(tag => (
                    <span key={tag} style={tagStyle}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Date */}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 'auto' }}>
                {formatDate(source.source_date || source.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return d
  }
}

// ---------- Styles ----------

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  background: 'rgba(0,0,0,0.95)',
  overflowY: 'auto',
  padding: '80px 24px 24px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  marginBottom: 24,
  maxWidth: 1000,
  margin: '0 auto 24px',
}

const gridStyle: React.CSSProperties = {
  maxWidth: 1000,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  transition: 'border-color 0.2s',
}

const tagStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 6,
  background: 'rgba(90,191,191,0.1)',
  color: 'rgba(90,191,191,0.7)',
  border: '1px solid rgba(90,191,191,0.15)',
}
