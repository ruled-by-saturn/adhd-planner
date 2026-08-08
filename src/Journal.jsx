import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const MOODS = ['😢', '😔', '😐', '😊', '😄']

const PLACEHOLDER = `How's your physical and mental health today?

How are you feeling?

Did you feel like you made personal growth today?`

function formatTitle(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Today's date key in GMT+7 (WIB), matching the rest of the app.
function gmt7Today() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function HalfStars({ rating }) {
  return (
    <span style={{ display: 'inline-flex' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const full = rating >= n
        const half = !full && rating >= n - 0.5
        return (
          <span key={n} style={{ position: 'relative', display: 'inline-block', fontSize: '13px' }}>
            <span style={{ color: '#ddd' }}>★</span>
            {(full || half) && (
              <span style={{
                color: '#534AB7', position: 'absolute', left: 0, top: 0,
                clipPath: half ? 'inset(0 50% 0 0)' : 'none'
              }}>★</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

function StarRating({ rating, onChange }) {
  function handleClick(e, starIndex) {
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.clientX ?? e.touches?.[0]?.clientX
    const x = clientX - rect.left
    const isLeft = x < rect.width / 2
    const newRating = isLeft ? starIndex - 0.5 : starIndex
    onChange(rating === newRating ? null : newRating)
  }

  return (
    <div className="rating-row">
      {[1, 2, 3, 4, 5].map(n => {
        const full = rating >= n
        const half = !full && rating >= n - 0.5
        return (
          <button key={n} className="star-btn-wrap" onClick={e => handleClick(e, n)}>
            <span className="star-empty">★</span>
            {(full || half) && (
              <span className="star-filled" style={{ clipPath: half ? 'inset(0 50% 0 0)' : 'none' }}>★</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ToolBtn({ onPress, title, children }) {
  return (
    <button
      className="rich-tool-btn"
      title={title}
      onMouseDown={e => { e.preventDefault(); onPress() }}
      onTouchEnd={e => { e.preventDefault(); onPress() }}
    >
      {children}
    </button>
  )
}

function RichEditor({ initialContent, onChange }) {
  const editorRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = initialContent || ''
      initialized.current = true
    }
  }, [])

  function exec(cmd, value = null) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function insertLink() {
    const url = window.prompt('Enter URL (include https://):')
    if (url) exec('createLink', url)
  }

  function handleInput() {
    onChange(editorRef.current?.innerHTML || '')
  }

  return (
    <div className="rich-editor-wrap">
      <div className="rich-toolbar">
        <ToolBtn onPress={() => exec('bold')} title="Bold"><b>B</b></ToolBtn>
        <ToolBtn onPress={() => exec('italic')} title="Italic"><i>I</i></ToolBtn>
        <ToolBtn onPress={() => exec('underline')} title="Underline"><u>U</u></ToolBtn>
        <ToolBtn onPress={() => exec('formatBlock', 'blockquote')} title="Quote">❝</ToolBtn>
        <ToolBtn onPress={insertLink} title="Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor"
        data-placeholder={PLACEHOLDER}
        onInput={handleInput}
      />
    </div>
  )
}

function MoodChart({ entries, range, onRangeChange }) {
  const today = new Date()
  const W = 300, H = 80, PAD = 12
  const cW = W - PAD * 2, cH = H - PAD * 2

  let points = []
  if (range === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const e = entries.find(e => e.date_key === key)
      points.push({ key, value: e?.mood ?? null })
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const prefix = d.toISOString().slice(0, 7)
      const month = entries.filter(e => e.date_key.startsWith(prefix) && e.mood)
      const avg = month.length ? month.reduce((s, e) => s + e.mood, 0) / month.length : null
      points.push({ key: prefix, value: avg })
    }
  }

  const n = points.length
  const dots = points.map((p, i) => ({
    x: PAD + (i / (n - 1)) * cW,
    y: p.value ? PAD + cH - ((p.value - 1) / 4) * cH : null,
    key: p.key,
  })).filter(d => d.y !== null)

  const linePath = dots.length > 1
    ? 'M' + dots.map(d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' L')
    : null

  return (
    <div className="mood-chart">
      <div className="mood-chart-top">
        <span className="mood-chart-label">Mood trend</span>
        <div className="chart-toggle">
          <button className={range === 'month' ? 'active' : ''} onClick={() => onRangeChange('month')}>Month</button>
          <button className={range === 'year' ? 'active' : ''} onClick={() => onRangeChange('year')}>Year</button>
        </div>
      </div>
      {dots.length < 2 ? (
        <div className="mood-chart-empty">Keep journaling to see your trend</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {[1, 2, 3, 4, 5].map(v => {
              const y = PAD + cH - ((v - 1) / 4) * cH
              return <line key={v} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#f0efe9" strokeWidth="1" />
            })}
            {linePath && <path d={linePath} fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {dots.map(d => <circle key={d.key} cx={d.x} cy={d.y} r="3" fill="#534AB7" />)}
          </svg>
          <div className="mood-y-axis">
            {MOODS.map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </>
      )}
    </div>
  )
}

function JournalEditor({ entry, onBack, onUpdate }) {
  const [mood, setMood] = useState(entry.mood ?? null)
  const [rating, setRating] = useState(entry.rating ?? null)
  const timerRef = useRef(null)
  const latestContent = useRef(entry.content || '')

  function save(content, m, r) {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onUpdate({ ...entry, content, mood: m, rating: r })
    }, 800)
  }

  function handleMood(m) {
    const next = mood === m ? null : m
    setMood(next)
    save(latestContent.current, next, rating)
  }

  function handleRating(r) {
    setRating(r)
    save(latestContent.current, mood, r)
  }

  function handleContent(html) {
    latestContent.current = html
    save(html, mood, rating)
  }

  return (
    <div className="journal-editor">
      <button className="journal-back-btn" onClick={onBack}>‹ Journal</button>
      <div className="journal-editor-date">{formatTitle(entry.date_key)}</div>

      <div className="journal-trackers">
        <div className="tracker-group">
          <div className="tracker-label">Mood</div>
          <div className="mood-row">
            {MOODS.map((emoji, i) => (
              <button
                key={i}
                className={`mood-btn${mood === i + 1 ? ' active' : ''}`}
                onClick={() => handleMood(i + 1)}
              >{emoji}</button>
            ))}
          </div>
        </div>
        <div className="tracker-group">
          <div className="tracker-label">Day rating</div>
          <StarRating rating={rating} onChange={handleRating} />
        </div>
      </div>

      <RichEditor initialContent={entry.content} onChange={handleContent} />
    </div>
  )
}

export function Journal({ user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [chartRange, setChartRange] = useState('month')
  const [pickDate, setPickDate] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('journal_entries').select('*')
      .eq('user_id', user.id)
      .order('date_key', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  // Open (or create) the entry for a given date and go to the editor.
  async function openEntry(dateKey) {
    setPickDate('')
    const existing = entries.find(e => e.date_key === dateKey)
    if (existing) { setSelectedId(existing.id); return }
    const entry = {
      id: Date.now().toString(),
      user_id: user.id,
      date_key: dateKey,
      content: '',
      mood: null,
      rating: null,
    }
    setEntries(prev => [entry, ...prev].sort((a, b) => b.date_key.localeCompare(a.date_key)))
    setSelectedId(entry.id)
    await supabase.from('journal_entries').insert(entry)
  }

  async function updateEntry(updated) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    await supabase.from('journal_entries')
      .update({ content: updated.content, mood: updated.mood, rating: updated.rating })
      .eq('id', updated.id)
  }

  if (loading) return <div className="loading">Loading...</div>

  const selected = entries.find(e => e.id === selectedId)
  if (selected) return (
    <JournalEditor entry={selected} onBack={() => setSelectedId(null)} onUpdate={updateEntry} />
  )

  return (
    <div className="journal-list">
      <div className="journal-list-header">
       <div className="journal-list-title">Journal</div>
        <div className="journal-header-actions">
        <input
          type="date"
          className="journal-date-picker"
          value={pickDate}
          max={gmt7Today()}
          onChange={e => setPickDate(e.target.value)}
        />
        <button
          className="journal-new-btn"
          onClick={() => openEntry(pickDate || gmt7Today())}
        >{pickDate ? 'Open' : '+ Today'}</button>
      </div>
    </div>

      <MoodChart entries={entries} range={chartRange} onRangeChange={setChartRange} />

      <div className="journal-entries">
        {entries.length === 0 && (
          <div className="empty">No entries yet — tap + Today to start</div>
        )}
        {entries.map(entry => {
          const preview = stripHtml(entry.content)
          return (
            <div key={entry.id} className="journal-card" onClick={() => setSelectedId(entry.id)}>
              <div className="journal-card-top">
                <div className="journal-card-date">{formatTitle(entry.date_key)}</div>
                {entry.mood && <span className="journal-card-emoji">{MOODS[entry.mood - 1]}</span>}
              </div>
              {entry.rating && (
                <div className="journal-card-stars">
                  <HalfStars rating={entry.rating} />
                </div>
              )}
              <div className={`journal-card-preview${!preview ? ' muted' : ''}`}>
                {preview ? preview.slice(0, 120) + (preview.length > 120 ? '...' : '') : 'Tap to write...'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}