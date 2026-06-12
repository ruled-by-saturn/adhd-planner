import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const MOODS = ['😢', '😔', '😐', '😊', '😄']

const PROMPTS = `How's your physical and mental health today?

How are you feeling?

Did you feel like you made personal growth today?`

function formatTitle(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShort(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block'}}>
            {[1,2,3,4,5].map(v => {
              const y = PAD + cH - ((v-1)/4)*cH
              return <line key={v} x1={PAD} y1={y} x2={W-PAD} y2={y} stroke="#f0efe9" strokeWidth="1"/>
            })}
            {linePath && <path d={linePath} fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
            {dots.map(d => <circle key={d.key} cx={d.x} cy={d.y} r="3" fill="#534AB7"/>)}
          </svg>
          <div className="mood-y-axis">
            {MOODS.map((e,i) => <span key={i}>{e}</span>)}
          </div>
        </>
      )}
    </div>
  )
}

function JournalEditor({ entry, onBack, onUpdate }) {
  const [content, setContent] = useState(entry.content || '')
  const [mood, setMood] = useState(entry.mood ?? null)
  const [rating, setRating] = useState(entry.rating ?? null)
  const timer = useRef(null)

  function save(c, m, r) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onUpdate({ ...entry, content: c, mood: m, rating: r })
    }, 800)
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
                className={`mood-btn${mood === i+1 ? ' active' : ''}`}
                onClick={() => { setMood(i+1); save(content, i+1, rating) }}
              >{emoji}</button>
            ))}
          </div>
        </div>
        <div className="tracker-group">
          <div className="tracker-label">Day rating</div>
          <div className="rating-row">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                className={`star-btn${rating >= n ? ' active' : ''}`}
                onClick={() => { setRating(n); save(content, mood, n) }}
              >★</button>
            ))}
          </div>
        </div>
      </div>

      <textarea
        className="journal-textarea"
        placeholder={PROMPTS}
        value={content}
        onChange={e => { setContent(e.target.value); save(e.target.value, mood, rating) }}
      />
    </div>
  )
}

export function Journal({ user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [chartRange, setChartRange] = useState('month')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('journal_entries').select('*')
      .eq('user_id', user.id)
      .order('date_key', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function newEntry() {
    const today = new Date().toISOString().split('T')[0]
    const existing = entries.find(e => e.date_key === today)
    if (existing) { setSelectedId(existing.id); return }
    const entry = {
      id: Date.now().toString(),
      user_id: user.id,
      date_key: today,
      content: '',
      mood: null,
      rating: null,
    }
    setEntries(prev => [entry, ...prev])
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
    <JournalEditor
      entry={selected}
      onBack={() => setSelectedId(null)}
      onUpdate={updateEntry}
    />
  )

  return (
    <div className="journal-list">
      <div className="journal-list-header">
        <div className="journal-list-title">Journal</div>
        <button className="journal-new-btn" onClick={newEntry}>+ Today</button>
      </div>

      <MoodChart entries={entries} range={chartRange} onRangeChange={setChartRange} />

      <div className="journal-entries">
        {entries.length === 0 && (
          <div className="empty">No entries yet — tap + Today to start</div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="journal-card" onClick={() => setSelectedId(entry.id)}>
            <div className="journal-card-top">
              <div className="journal-card-date">{formatTitle(entry.date_key)}</div>
              {entry.mood && <span className="journal-card-emoji">{MOODS[entry.mood - 1]}</span>}
            </div>
            {entry.rating && (
              <div className="journal-card-stars">
                <span style={{color:'#534AB7'}}>{'★'.repeat(entry.rating)}</span>
                <span style={{color:'#ddd'}}>{'★'.repeat(5 - entry.rating)}</span>
              </div>
            )}
            <div className={`journal-card-preview${!entry.content ? ' muted' : ''}`}>
              {entry.content ? entry.content.slice(0, 120) + (entry.content.length > 120 ? '...' : '') : 'Tap to write...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}