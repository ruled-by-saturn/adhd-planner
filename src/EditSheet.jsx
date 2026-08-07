import { useState } from 'react'

export function EditSheet({ task, onSave, onClose }) {
  const [text, setText] = useState(task.text)
  const [time, setTime] = useState(task.time || '')

  function save() {
    if (!text.trim()) return
    onSave({ text: text.trim(), time })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Edit task</div>

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
            {time && (
              <button className="edit-clear" onClick={() => setTime('')}>Clear</button>
            )}
          </div>
        </div>

        {task.recurrence && (
          <div className="edit-note">Changes apply to every occurrence of this recurring task.</div>
        )}

        <button className="sheet-confirm edit-save" disabled={!text.trim()} onClick={save}>Save</button>
        <button className="sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
