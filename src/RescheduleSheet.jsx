import { useState } from 'react'

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function RescheduleSheet({ taskText, onReschedule, onClose }) {
  const [customDate, setCustomDate] = useState('')

  const options = [
    { label: 'Tomorrow',   sub: formatShort(1), value: offsetDate(1) },
    { label: 'In 2 days',  sub: formatShort(2), value: offsetDate(2) },
    { label: 'Next week',  sub: formatShort(7), value: offsetDate(7) },
  ]

  function formatShort(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Reschedule</div>
        <div className="sheet-task-name">{taskText}</div>

        <div className="sheet-options">
          {options.map(opt => (
            <button
              key={opt.value}
              className="sheet-option"
              onClick={() => onReschedule(opt.value)}
            >
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
              min={offsetDate(1)}
              onChange={e => setCustomDate(e.target.value)}
            />
            <button
              className="sheet-confirm"
              disabled={!customDate}
              onClick={() => customDate && onReschedule(customDate)}
            >
              Move
            </button>
          </div>
        </div>

        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}