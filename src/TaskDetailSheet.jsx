import { useState } from 'react'

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // GMT+7, matching App's date keys.

function offsetFromToday(days) {
  const d = new Date(Date.now() + TZ_OFFSET_MS)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function addDaysFromKey(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function formatShort(dateKey) {
  return new Date(dateKey + 'T00:00:00Z')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function TaskDetailSheet({ task, onSave, onClose }) {
  const [text, setText] = useState(task.text)
  const [time, setTime] = useState(task.time || '')
  const [date, setDate] = useState(task.date_key)

  const quick = [
    { label: 'Today', value: offsetFromToday(0) },
    { label: 'Tomorrow', value: offsetFromToday(1) },
    { label: 'Next week', value: addDaysFromKey(task.date_key, 7) },
  ]

  function save() {
    if (!text.trim()) return
    onSave({ text: text.trim(), time, date })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Task details</div>

        <div className="edit-field">
          <label className="edit-label">Task name</label>
          <input
            className="edit-input"
            value={text}
            autoFocus
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>

        <div className="edit-field">
          <label className="edit-label">Time</label>
          <div className="edit-time-row">
            <input
              type="time"
              className="edit-input"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            {time && <button className="edit-clear" onClick={() => setTime('')}>Clear</button>}
          </div>
        </div>

        <div className="edit-field">
          <label className="edit-label">Date</label>
          <div className="detail-date-chips">
            {quick.map(q => (
              <button
                key={q.value}
                className={`detail-chip${date === q.value ? ' active' : ''}`}
                onClick={() => setDate(q.value)}
              >
                <span className="detail-chip-label">{q.label}</span>
                <span className="detail-chip-sub">{formatShort(q.value)}</span>
              </button>
            ))}
          </div>
          <input
            type="date"
            className="edit-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {task.recurrence && (
          <div className="edit-note">
            Name &amp; time changes apply to every occurrence of this recurring task. Changing the date moves only this one.
          </div>
        )}

        <button className="sheet-confirm edit-save" disabled={!text.trim()} onClick={save}>Save</button>
        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
