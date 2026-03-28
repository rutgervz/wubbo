'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPanel({ graphContext }: { graphContext?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Add empty assistant message for streaming
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
            if (parsed.text) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  last.content += parsed.text
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          last.content = 'Er ging iets mis. Probeer het opnieuw.'
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming, graphContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={fabStyle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Wubbo</span>
        {graphContext && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
            · {graphContext}
          </span>
        )}
        <button onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
      </div>

      {/* Messages */}
      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
            Stel een vraag over de kennisbank...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            ...messageBubbleStyle,
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'rgba(90,191,191,0.15)' : 'rgba(255,255,255,0.05)',
            borderColor: m.role === 'user' ? 'rgba(90,191,191,0.3)' : 'rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span style={cursorStyle}>▊</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={inputContainerStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Vraag aan Wubbo..."
          rows={1}
          style={textareaStyle}
          disabled={streaming}
        />
        <button
          onClick={sendMessage}
          disabled={streaming || !input.trim()}
          style={{
            ...sendBtnStyle,
            opacity: streaming || !input.trim() ? 0.3 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}

// ---------- Styles ----------

const fabStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  zIndex: 100,
  width: 52,
  height: 52,
  borderRadius: '50%',
  background: 'rgba(90,191,191,0.2)',
  border: '1px solid rgba(90,191,191,0.4)',
  color: '#5ABFBF',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(8px)',
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  zIndex: 100,
  width: 380,
  height: 520,
  background: 'rgba(8,12,20,0.95)',
  border: '1px solid rgba(90,191,191,0.2)',
  borderRadius: 16,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backdropFilter: 'blur(16px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  color: '#5ABFBF',
}

const closeBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.4)',
  fontSize: 20,
  cursor: 'pointer',
  padding: '0 4px',
}

const messagesStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const messageBubbleStyle: React.CSSProperties = {
  maxWidth: '85%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid',
  color: '#e0e0e0',
}

const cursorStyle: React.CSSProperties = {
  animation: 'pulse 1s ease-in-out infinite',
  color: '#5ABFBF',
  marginLeft: 2,
}

const inputContainerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#e0e0e0',
  fontSize: 13,
  resize: 'none',
  outline: 'none',
  fontFamily: 'inherit',
}

const sendBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'rgba(90,191,191,0.2)',
  border: '1px solid rgba(90,191,191,0.3)',
  color: '#5ABFBF',
  cursor: 'pointer',
  fontSize: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
