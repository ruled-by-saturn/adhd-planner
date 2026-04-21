import { useState } from 'react'

function offsetFromToday(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function addDaysFromDate(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatShort(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function RescheduleSheet({ taskText, currentDate, onReschedule, onClose }) {
  const [customDate, setCustomDate] = useState('')

  const tomorrow = offsetFromToday(1)
  const nextWeek = addDaysFromDate(currentDate, 7)

  const options = [
    { label: 'Tomorrow',   sub: formatShort(tomorrow),  value: tomorrow  },
    { label: 'Next week',  sub: formatShort(nextWeek),   value: nextWeek  },
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
              min={offsetFromToday(1)}
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