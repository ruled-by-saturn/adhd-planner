import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PILL = {
  High:     { bg: '#FAECE7', color: '#993C1D' },
  Medium:    { bg: '#FAEEDA', color: '#854F0B' },
  Low:        { bg: '#EEEDFE', color: '#534AB7' },
}

export function TaskCard({ task, onToggle, onDelete, onChangePriority, onLongPress }) {
  const { attributes, listeners, setNodeRef,
          transform, transition, isDragging } = useSortable({ id: task.id })

  const timerRef = useRef(null)
  const moved = useRef(false)

  function onTouchStart(e) {
    moved.current = false
    timerRef.current = setTimeout(() => {
      if (!moved.current) onLongPress(task.id)
    }, 600)
  }

  function onTouchMove() {
    moved.current = true
    clearTimeout(timerRef.current)
  }

  function onTouchEnd() {
    clearTimeout(timerRef.current)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const pill = PILL[task.priority] || PILL.Someday

  return (
    <div ref={setNodeRef} style={style} className={`task-card${task.done ? ' done' : ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>⋮</span>
      <button
        className={`check${task.done ? ' checked' : ''}`}
        onClick={() => onToggle(task.id)}
      >
        {task.done && <span className="checkmark" />}
      </button>
      <div
        className="task-body"
        onDoubleClick={() => onLongPress(task.id)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="task-text">{task.text}</span>
        {task.time && <span className="task-time">{task.time}</span>}
        {task.recurrence && (
          <span className="recurrence-badge">↻ {task.recurrence}</span>
        )}
      </div>
      <select
        className="priority-select"
        style={{ background: pill.bg, color: pill.color }}
        value={task.priority}
        onChange={e => onChangePriority(task.id, e.target.value)}
      >
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>
      <button className="delete-btn" onClick={() => onDelete(task.id)}>×</button>
    </div>
  )
}