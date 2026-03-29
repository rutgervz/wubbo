'use client'

import { useState, useEffect, useCallback } from 'react'

interface SourceData {
  id: string
  title: string
  source_type: string
  url: string | null
  status: string
  created_at: string
  person_name: string | null
  person_color: string | null
  tags: Array<{ id: string; name: string; color: string }>
  chunks: Array<{ id: string; content: string; chunk_index: number }>
}

const TYPE_ICONS: Record<string, string> = {
  claude_chat: '💬',
  article: '📄',
  video: '🎬',
  podcast: '🎙️',
  document: '📋',
  note: '📝',
  book: '📚',
}

export default function SourceDetail({
  sourceId,
  onClose,
}: {
  sourceId: string | null
  onClose: () => void
}) {
  const [source, setSource] = useState<SourceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceId) {
      setSource(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/sources/${sourceId}`)
      .then(res => {
        if (!res.ok) throw new Error('Bron ophalen mislukt')
        return res.json()
      })
      .then(data => setSource(data.source))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [sourceId])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (sourceId) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [sourceId, handleKeyDown])

  if (!sourceId) return null

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 89,
          transition: 'opacity 0.3s',
          opacity: sourceId ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 90vw)',
          zIndex: 90,
          background: 'rgba(8,12,20,0.98)',
          borderLeft: '1px solid rgba(90,191,191,0.2)',
          display: 'flex',
          flexDirection: 'column',
          transform: sourceId ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 22,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {source && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>
                    {TYPE_ICONS[source.source_type] || '📄'}
                  </span>
                  {source.person_name && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: `${source.person_color || '#888'}22`,
                        color: source.person_color || '#888',
                        border: `1px solid ${source.person_color || '#888'}44`,
                      }}
                    >
                      {source.person_name}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {formatDate(source.created_at)}
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#fff',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {source.title}
                </h2>
                {source.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {source.tags.map(tag => (
                      <span
                        key={tag.id}
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: `${tag.color || '#5ABFBF'}15`,
                          color: tag.color || '#5ABFBF',
                          border: `1px solid ${tag.color || '#5ABFBF'}30`,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {loading && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Laden...
            </div>
          )}
          {error && (
            <div style={{ color: '#E8795D', fontSize: 13, textAlign: 'center', padding: 40 }}>
              {error}
            </div>
          )}
          {source && !loading && (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {source.chunks.map((chunk, i) => (
                <p key={chunk.id} style={{ marginBottom: i < source.chunks.length - 1 ? 16 : 0 }}>
                  {chunk.content}
                </p>
              ))}
              {source.chunks.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                  Geen inhoud beschikbaar voor deze bron.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with URL */}
        {source?.url && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#5ABFBF',
                textDecoration: 'none',
                opacity: 0.7,
              }}
            >
              Originele bron →
            </a>
          </div>
        )}
      </div>
    </>
  )
}
