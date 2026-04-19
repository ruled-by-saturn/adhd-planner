import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PILL = {
  Now:     { bg: '#FAECE7', color: '#993C1D' },
  Soon:    { bg: '#FAEEDA', color: '#854F0B' },
  Someday: { bg: '#EEEDFE', color: '#534AB7' },
}

export function TaskCard({ task, onToggle, onDelete, onChangePriority, onLongPress }) {
  const { attributes, listeners, setNodeRef,
          transform, transition, isDragging } = useSortable({ id: task.id })

function handleContextMenu(e) {
  e.preventDefault()
  onLongPress(task.id)
}

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const pill = PILL[task.priority] || PILL.Someday

  return (
    <div
  ref={setNodeRef}
  style={style}
  className={`task-card${task.done ? ' done' : ''}`}
  onContextMenu={handleContextMenu}
    >
      <span className="drag-handle" {...attributes} {...listeners}>⋮</span>
      <button
  className={`check${task.done ? ' checked' : ''}`}
  onClick={() => onToggle(task.id)}
    >
        {task.done && <span className="checkmark" />}
      </button>
      <div className="task-body">
        <span className="task-text">{task.text}</span>
        {task.time && <span className="task-time">{task.time}</span>}
      </div>
      <select
        className="priority-select"
        style={{ background: pill.bg, color: pill.color }}
        value={task.priority}
        onChange={e => onChangePriority(task.id, e.target.value)}
      >
        <option>Now</option>
        <option>Soon</option>
        <option>Someday</option>
      </select>
      <button className="delete-btn" onClick={() => onDelete(task.id)}>×</button>
    </div>
  )
}