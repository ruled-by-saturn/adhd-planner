import { useState } from 'react'

function addDays(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatShort(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function RescheduleSheet({ taskText, currentDate, onReschedule, onClose }) {
  const [customDate, setCustomDate] = useState('')

  const options = [
    { label: 'Tomorrow',  sub: formatShort(currentDate, 1), value: addDays(currentDate, 1) },
    { label: 'In 2 days', sub: formatShort(currentDate, 2), value: addDays(currentDate, 2) },
    { label: 'Next week', sub: formatShort(currentDate, 7), value: addDays(currentDate, 7) },
  ]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Reschedule</div>
        <div className="sheet-task-name">{taskText}</div>

        <div className="sheet-options">
          {options.map(opt => (
            <button key={opt.value} className="sheet-option" onClick={() => onReschedule(opt.value)}>
              <span className="sheet-option-label">{opt.label}</span>
              <span className="sheet-option-sub">{opt.sub}</span>
            </button>
          ))}
        </div>

        <div className="sheet-divider" />

        <div className="sheet-custom">
          <label className="sheet-custom-label">Pick a date</label>
          <div className="sheet-custom-row">
            <input
              type="date"
              className="sheet-date-input"
              value={customDate}
              min={addDays(currentDate, 1)}
              onChange={e => setCustomDate(e.target.value)}
            />
            <button
              className="sheet-confirm"
              disabled={!customDate}
              onClick={() => customDate && onReschedule(customDate)}
            >Move</button>
          </div>
        </div>

        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}