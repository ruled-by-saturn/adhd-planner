const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDateKey(date) {
  return date.toISOString().split('T')[0]
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function MonthView({ tasksByDay, onSelectDay, onClose, initialDate }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  return (
    <div className="month-overlay">
      <div className="month-header">
        <button className="nav-btn" onClick={prevMonth}>‹</button>
        <div className="month-title">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button className="nav-btn" onClick={nextMonth}>›</button>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="weekday-row">
        {DAYS.map(d => <div key={d} className="weekday-label">{d}</div>)}
      </div>

      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />
          const key = getDateKey(date)
          const tasks = tasksByDay[key] || []
          const doneTasks = tasks.filter(t => t.done)
          const isToday = isSameDay(date, today)
          const isSelected = isSameDay(date, initialDate)
          const hasTasks = tasks.length > 0

          return (
            <div
              key={key}
              className={[
                'cal-day',
                isToday ? 'cal-today' : '',
                isSelected ? 'cal-selected' : '',
              ].join(' ')}
              onClick={() => onSelectDay(date)}
            >
              <span className="cal-num">{date.getDate()}</span>
              {hasTasks && (
                <div className="dot-row">
                  {tasks.slice(0, 3).map((t, idx) => (
                    <div key={idx} className={`dot dot-${t.priority.toLowerCase()}${t.done ? ' dot-done' : ''}`} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useState } from 'react'