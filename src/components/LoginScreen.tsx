'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Ongeldige inloggegevens')
        return
      }

      onLogin()
    } catch {
      setError('Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#5ABFBF', margin: 0, letterSpacing: '0.08em' }}>
            WUBBO
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            De kennisbank van Rutger en Annelie
          </p>
        </div>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={fieldStyle}
          autoFocus
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Wachtwoord"
          required
          style={fieldStyle}
        />

        {error && (
          <div style={{ color: '#E8795D', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Laden...' : 'Inloggen'}
        </button>
      </form>

      {/* Subtle Wubbo Ockels reference */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.12)' }}>
        Vernoemd naar Wubbo Ockels · de eerste Nederlander in de ruimte
      </div>
    </div>
  )
}

// ---------- Styles ----------

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#000',
  zIndex: 200,
}

const formStyle: React.CSSProperties = {
  width: 320,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  background: 'rgba(90,191,191,0.2)',
  border: '1px solid rgba(90,191,191,0.4)',
  borderRadius: 10,
  padding: '12px 0',
  color: '#5ABFBF',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
