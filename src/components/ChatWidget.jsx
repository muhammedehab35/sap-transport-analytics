import { useState, useRef, useEffect } from 'react'
import './ChatWidget.css'

const API_URL = import.meta.env.VITE_CHATBOT_API_URL

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Bonjour ! Posez-moi une question sur les transports SAP (statuts, risques, KPI mensuels).' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showColdStartHint, setShowColdStartHint] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function sendMessage() {
    const question = input.trim()
    if (!question || isLoading) return

    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setIsLoading(true)

    const coldStartTimer = setTimeout(() => setShowColdStartHint(true), 4000)

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await response.json()
      const text = response.ok ? data.answer : (data.error || 'Une erreur est survenue.')
      setMessages((prev) => [...prev, { role: 'assistant', text }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Impossible de contacter le serveur. Réessayez plus tard.' }])
    } finally {
      clearTimeout(coldStartTimer)
      setShowColdStartHint(false)
      setIsLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>Assistant transports</span>
            <button onClick={() => setIsOpen(false)} aria-label="Fermer">×</button>
          </div>
          <div className="chat-panel-messages" ref={listRef}>
            {messages.map((message, index) => (
              <div key={index} className={`chat-message chat-message-${message.role}`}>
                {message.text}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-message-assistant chat-message-loading">
                {showColdStartHint
                  ? "Le serveur se réveille, ça peut prendre jusqu'à une minute..."
                  : '...'}
              </div>
            )}
          </div>
          <div className="chat-panel-input">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={isLoading}
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              Envoyer
            </button>
          </div>
        </div>
      )}
      <button className="chat-bubble" onClick={() => setIsOpen((prev) => !prev)} aria-label="Ouvrir l'assistant">
        {isOpen ? '×' : '💬'}
      </button>
    </div>
  )
}

export default ChatWidget
