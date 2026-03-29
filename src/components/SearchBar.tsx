'use client'

import { useState, useCallback, useRef } from 'react'

interface SearchResult {
  source_id: string
  title: string
  source_type: string
  person_name: string | null
  source_date: string | null
  snippet: string
  score: number
}

export default function SearchBar({ onSourceSelect }: { onSourceSelect?: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    setShowResults(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 400)
  }

  return (
    <div style={wrapperStyle}>
      <div style={barStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Zoek in Wubbo..."
          style={inputStyle}
        />
        {searching && <span style={{ fontSize: 12, color: 'rgba(90,191,191,0.5)' }}>...</span>}
      </div>

      {showResults && results.length > 0 && (
        <div style={dropdownStyle}>
          {results.map(r => (
            <div
              key={r.source_id}
              style={resultStyle}
              onClick={() => {
                onSourceSelect?.(r.source_id)
                setShowResults(false)
                setQuery('')
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,191,191,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {r.source_type}
                {r.person_name && ` · ${r.person_name}`}
                {r.source_date && ` · ${new Date(r.source_date).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`}
              </div>
              {r.snippet && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.4 }}>
                  {r.snippet.length > 100 ? r.snippet.slice(0, 100) + '...' : r.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showResults && !searching && results.length === 0 && query.length >= 2 && (
        <div style={dropdownStyle}>
          <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Geen resultaten
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Styles ----------

const wrapperStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 80,
  width: 360,
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(8,12,20,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '8px 14px',
  backdropFilter: 'blur(12px)',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  color: '#e0e0e0',
  fontSize: 13,
  fontFamily: 'inherit',
}

const dropdownStyle: React.CSSProperties = {
  marginTop: 6,
  background: 'rgba(8,12,20,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  overflow: 'hidden',
  maxHeight: 400,
  overflowY: 'auto',
  backdropFilter: 'blur(16px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
}

const resultStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  cursor: 'pointer',
}
