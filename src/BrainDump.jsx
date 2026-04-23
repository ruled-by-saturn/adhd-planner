import { useState, useRef } from 'react'

const PILL = {
  High:     { bg: '#FAECE7', color: '#993C1D' },
  Medium:    { bg: '#FAEEDA', color: '#854F0B' },
  Low: { bg: '#EEEDFE', color: '#534AB7' },
}

export function BrainDump({ onAccept, onClose }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  function toggleSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported in this browser'); return }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
    const newTranscript = Array.from(e.results)
        .slice(e.resultIndex)
        .map(r => r[0].transcript)
        .join(' ')
    setText(prev => (prev ? prev + ' ' + newTranscript : newTranscript).trim())
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognition.start()
    setListening(true)
  }

  async function process() {
    if (!text.trim()) return
    setProcessing(true)
    setError(null)
    recognitionRef.current?.stop()
    setListening(false)

    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/braindump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTasks(data.tasks.map((t, i) => ({ ...t, id: Date.now() + i })))
    } catch (err) {
      setError('Something went wrong. Try again.')
    } finally {
      setProcessing(false)
    }
  }

  function accept(task) {
    onAccept(task)
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  function reject(task) {
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  const allDone = tasks !== null && tasks.length === 0

  return (
    <div className="bd-overlay">
      <div className="bd-sheet">
        <div className="bd-header">
          <div>
            <div className="bd-title">Brain dump</div>
            <div className="bd-sub">Say or type anything on your mind</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {!tasks && (
          <>
            <div className={`bd-textarea-wrap${listening ? ' listening' : ''}`}>
              <textarea
                className="bd-textarea"
                placeholder="e.g. need to call mum tomorrow morning, also finish the report by friday, and at some point reorganise my desk..."
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
              />
              {listening && (
                <div className="bd-listening-badge">
                  <span className="bd-pulse" /> Listening...
                </div>
              )}
            </div>

            <div className="bd-actions">
              <button
                className={`bd-mic-btn${listening ? ' active' : ''}`}
                onClick={toggleSpeech}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                {listening ? 'Stop' : 'Speak'}
              </button>
              <button
                className="bd-process-btn"
                onClick={process}
                disabled={!text.trim() || processing}
              >
                {processing ? 'Processing...' : 'Break it down'}
              </button>
            </div>

            {error && <div className="bd-error">{error}</div>}
          </>
        )}

        {tasks && !allDone && (
          <>
            <div className="bd-tasks-label">
              Accept or reject each task
            </div>
            <div className="bd-task-list">
              {tasks.map(task => {
                const pill = PILL[task.priority] || PILL.Low
                return (
                  <div key={task.id} className="bd-task-card">
                    <div className="bd-task-body">
                      <div className="bd-task-text">{task.text}</div>
                      <div className="bd-task-meta">
                        <span className="bd-pill" style={{ background: pill.bg, color: pill.color }}>
                          {task.priority}
                        </span>
                        {task.date && (
                          <span className="bd-meta-tag">
                            {new Date(task.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.time && (
                          <span className="bd-meta-tag">{task.time}</span>
                        )}
                      </div>
                    </div>
                    <div className="bd-task-btns">
                      <button className="bd-reject" onClick={() => reject(task)}>×</button>
                      <button className="bd-accept" onClick={() => accept(task)}>✓</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {allDone && (
          <div className="bd-done">
            <div className="bd-done-icon">✓</div>
            <div className="bd-done-text">All sorted!</div>
            <button className="bd-process-btn" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}