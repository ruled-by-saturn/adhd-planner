import { useState, useRef, useEffect } from 'react'
import { TaskDetailSheet } from './TaskDetailSheet'
import { MonthView } from './MonthView'
import { Auth } from './Auth'
import { BrainDump } from './BrainDump'
import { Journal } from './Journal'
import { supabase } from './supabase'

import {
  DndContext, closestCenter, TouchSensor,
  MouseSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import './app.css'

const PRIORITIES = ['High', 'Medium', 'Low']

// How many days ahead recurring tasks are materialized.
const HORIZON_DAYS = 60

// All dates are anchored to GMT+7 (WIB), independent of the device timezone,
// so "today" / date keys don't drift around midnight.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000

// Format a Date's UTC fields as a YYYY-MM-DD key.
function keyFromUTC(d) {
  return d.toISOString().split('T')[0]
}

// Current GMT+7 calendar date, shifted by `offset` days.
function getDateKey(offset = 0) {
  const d = new Date(Date.now() + TZ_OFFSET_MS)
  d.setUTCDate(d.getUTCDate() + offset)
  return keyFromUTC(d)
}

// A Date object whose UTC fields hold the GMT+7 wall-clock date for a key —
// used only for formatting (render with timeZone: 'UTC').
function dateFromKey(dateKey) {
  return new Date(dateKey + 'T00:00:00Z')
}

// A recurring series shares one root id. Occurrence rows use `${root}__${date}`,
// the first/master row uses the plain root id — so all members map to one root.
function seriesRoot(task) {
  return task.id.includes('__') ? task.id.split('__')[0] : task.id
}

// Materialize any missing occurrences of every recurring series up to uptoKey.
// Forward-fills from each series' latest existing instance, so deleting a single
// past/middle occurrence never resurrects it.
function generateOccurrences(byDay, uptoKey) {
  const groups = {}
  Object.values(byDay).flat().forEach(t => {
    if (!t.recurrence) return
    const root = seriesRoot(t)
    if (!groups[root]) groups[root] = []
    groups[root].push(t)
  })

  const next = { ...byDay }
  const inserts = []
  for (const root in groups) {
    const latest = groups[root].reduce((a, b) => (b.date_key > a.date_key ? b : a))
    let cursor = latest.date_key
    while (true) {
      const nd = getNextDate(cursor, latest.recurrence)
      if (nd > uptoKey) break
      const dayArr = next[nd] ? [...next[nd]] : []
      if (!dayArr.some(t => seriesRoot(t) === root)) {
        const occ = {
          id: `${root}__${nd}`,
          date_key: nd,
          text: latest.text,
          priority: latest.priority,
          done: false,
          time: latest.time,
          position: dayArr.length,
          user_id: latest.user_id,
          recurrence: latest.recurrence,
        }
        dayArr.push(occ)
        inserts.push(occ)
        next[nd] = dayArr
      }
      cursor = nd
    }
  }
  return { next, inserts }
}

function formatDay(offset) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  return dateFromKey(getDateKey(offset))
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

function formatDate(offset) {
  return dateFromKey(getDateKey(offset))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function getNextDate(dateKey, recurrence) {
  const d = dateFromKey(dateKey)
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  return keyFromUTC(d)
}

export default function App() {
  const [dayOffset, setDayOffset] = useState(0)
  const [tasksByDay, setTasksByDay] = useState({})
  const [sortMode, setSortMode] = useState('priority')
  const [input, setInput] = useState('')
  const [newPriority, setNewPriority] = useState('Medium')
  const [newTime, setNewTime] = useState('')
  const [showMonth, setShowMonth] = useState(false)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const inputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('tasks')
  const [newRecurrence, setNewRecurrence] = useState('')
// remove: const [showBrainDump, setShowBrainDump] = useState(false)

  useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null)
    if (session?.user) loadTasks(session.user.id)
    else setLoading(false)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
    if (session?.user) loadTasks(session.user.id)
    else { setTasksByDay({}); setLoading(false) }
  })

  return () => subscription.unsubscribe()
}, [])

async function loadTasks(userId) {
  const { data, error } = await supabase
    .from('tasks').select('*')
    .eq('user_id', userId)
    .order('position')
  if (error) { console.error(error); setLoading(false); return }
  const byDay = {}
  data.forEach(task => {
    if (!byDay[task.date_key]) byDay[task.date_key] = []
    byDay[task.date_key].push(task)
  })

  // Fill in recurring occurrences for the rolling horizon.
  const { next, inserts } = generateOccurrences(byDay, getDateKey(HORIZON_DAYS))
  setTasksByDay(next)
  setLoading(false)
  if (inserts.length) {
    await supabase.from('tasks').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true })
  }
}

// Extend the recurring horizon when navigating far into the future.
useEffect(() => {
  if (!user) return
  const viewedKey = getDateKey(dayOffset)
  const baseKey = getDateKey(HORIZON_DAYS)
  const uptoKey = viewedKey > baseKey ? getDateKey(dayOffset + 14) : baseKey
  const { next, inserts } = generateOccurrences(tasksByDay, uptoKey)
  if (!inserts.length) return
  setTasksByDay(next)
  supabase.from('tasks').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dayOffset, user])

  const dateKey = getDateKey(dayOffset)
  const tasks = tasksByDay[dateKey] || []

  function setTasks(updated) {
    setTasksByDay(prev => ({ ...prev, [dateKey]: updated }))
  }

 async function addTask() {
  if (!input.trim()) return
  const task = {
    id: Date.now().toString(),
    date_key: dateKey,
    text: input.trim(),
    priority: newPriority,
    done: false,
    time: newTime,
    position: tasks.length,
    user_id: user.id,
    recurrence: newRecurrence || null,
  }
  setInput('')
  setNewTime('')
  setNewRecurrence('')
  await supabase.from('tasks').insert(task)

  if (task.recurrence) {
    // Materialize the rest of the series across the horizon right away, so it
    // shows on every future day — not only after today's is completed.
    const seeded = { ...tasksByDay, [dateKey]: [...tasks, task] }
    const { next, inserts } = generateOccurrences(seeded, getDateKey(HORIZON_DAYS))
    setTasksByDay(next)
    if (inserts.length) {
      await supabase.from('tasks').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true })
    }
  } else {
    setTasks([...tasks, task])
  }
}

  async function toggleDone(id) {
  const task = tasks.find(t => t.id === id)
  if (!task) return
  const newDone = !task.done
  setTasks(tasks.map(t => t.id === id ? { ...t, done: newDone } : t))
  await supabase.from('tasks').update({ done: newDone }).eq('id', id)
  // Future occurrences already exist for recurring series — no spawning here.
}

  function deleteTask(id) {
    const task = tasks.find(t => t.id === id)
    if (task?.recurrence) {
      // Recurring: ask whether to remove just this one or the whole series.
      setDeletingTask(task)
      return
    }
    removeOccurrence(id)
  }

  async function removeOccurrence(id) {
    setTasks(tasks.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function deleteSeries(task) {
    const root = seriesRoot(task)
    // Collect every occurrence id of this series (exact match on root, so a
    // numeric root can't be mistaken for a prefix of another series' root).
    const ids = Object.values(tasksByDay).flat()
      .filter(t => seriesRoot(t) === root)
      .map(t => t.id)
    setTasksByDay(prev => {
      const next = {}
      for (const day in prev) {
        next[day] = prev[day].filter(t => seriesRoot(t) !== root)
      }
      return next
    })
    setDeletingTask(null)
    if (ids.length) await supabase.from('tasks').delete().in('id', ids)
  }

  async function changePriority(id, priority) {
    setTasks(tasks.map(t => t.id === id ? { ...t, priority } : t))
    await supabase.from('tasks').update({ priority }).eq('id', id)
  }

  // Saves everything from the task detail sheet: name, time, and (for a single
  // occurrence) the date. Name & time apply to the whole series if recurring;
  // moving the date always affects just the one occurrence, like a calendar.
  async function saveTaskDetails(id, { text, time, date }) {
    const task = Object.values(tasksByDay).flat().find(t => t.id === id)
    setReschedulingId(null)
    if (!task || !text) return

    const root = seriesRoot(task)
    const isSeries = !!task.recurrence
    const matches = t => (isSeries ? seriesRoot(t) === root : t.id === id)
    const dateChanged = date && date !== task.date_key

    setTasksByDay(prev => {
      const next = {}
      for (const day in prev) {
        next[day] = prev[day].map(t => matches(t) ? { ...t, text, time } : t)
      }
      if (dateChanged) {
        const moving = next[task.date_key].find(t => t.id === id)
        next[task.date_key] = next[task.date_key].filter(t => t.id !== id)
        const targetArr = next[date] ? [...next[date]] : []
        next[date] = [...targetArr, { ...moving, date_key: date, position: targetArr.length }]
      }
      return next
    })

    // Persist name/time (across the series if recurring).
    const editIds = isSeries
      ? Object.values(tasksByDay).flat().filter(t => seriesRoot(t) === root).map(t => t.id)
      : [id]
    if (editIds.length) await supabase.from('tasks').update({ text, time }).in('id', editIds)

    // Persist the single-occurrence move.
    if (dateChanged) {
      const targetLen = (tasksByDay[date] || []).length
      await supabase.from('tasks').update({ date_key: date, position: targetLen }).eq('id', id)
    }
  }

  async function acceptBrainDumpTask(task) {
  const targetDate = task.date || getDateKey(0)
  const existing = tasksByDay[targetDate] || []
  const recurrence = ['daily', 'weekly', 'monthly'].includes(task.recurrence) ? task.recurrence : null
  const newTask = {
    id: Date.now().toString(),
    date_key: targetDate,
    text: task.text,
    priority: task.priority,
    done: false,
    time: task.time || '',
    position: existing.length,
    user_id: user.id,
    recurrence,
  }
  await supabase.from('tasks').insert(newTask)

  if (recurrence) {
    // Fan the recurring task out across the horizon, same as adding one manually.
    const seeded = { ...tasksByDay, [targetDate]: [...existing, newTask] }
    const { next, inserts } = generateOccurrences(seeded, getDateKey(HORIZON_DAYS))
    setTasksByDay(next)
    if (inserts.length) {
      await supabase.from('tasks').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true })
    }
  } else {
    setTasksByDay(prev => ({
      ...prev,
      [targetDate]: [...(prev[targetDate] || []), newTask],
    }))
  }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIdx = tasks.findIndex(t => t.id === active.id)
      const newIdx = tasks.findIndex(t => t.id === over.id)
      const reordered = arrayMove(tasks, oldIdx, newIdx)
      setTasks(reordered)
      await supabase.from('tasks').upsert(
        reordered.map((t, i) => ({ ...t, position: i }))
      )
    }
  }

  const sortedTasks = sortMode === 'priority'
    ? [...tasks].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority))
    : [...tasks].sort((a, b) => {
        if (!a.time && !b.time) return 0
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })


  const grouped = PRIORITIES.reduce((acc, p) => {
    acc[p] = sortedTasks.filter(t => t.priority === p)
    return acc
  }, {})

    if (loading) return <div className="loading">Loading...</div>
  if (!user) return <Auth />

  return (
    <div className="app">

      {activeTab === 'tasks' && (
        <>
          <div className="topbar">
            <button className="signout-btn" onClick={() => supabase.auth.signOut()} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
            <div className="day-nav">
              <button className="nav-btn" onClick={() => setDayOffset(o => o - 1)}>‹</button>
              <div className="day-info">
                <div className="day-label">{formatDay(dayOffset)}</div>
                <div className="date-sub">{formatDate(dayOffset)}</div>
              </div>
              <button className="nav-btn" onClick={() => setDayOffset(o => o + 1)}>›</button>
            </div>
            <div className="sort-toggle">
              <button className={sortMode === 'priority' ? 'sort-btn active' : 'sort-btn'}
                onClick={() => setSortMode('priority')}>Priority</button>
              <button className={sortMode === 'chrono' ? 'sort-btn active' : 'sort-btn'}
                onClick={() => setSortMode('chrono')}>Chronological</button>
              <button className="month-btn" onClick={() => setShowMonth(true)}>📅</button>
            </div>
          </div>

          <div className="task-list">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {sortMode === 'priority'
                  ? PRIORITIES.map(p => grouped[p].length > 0 && (
                      <div key={p}>
                        <div className="section-label">{p}</div>
                        {grouped[p].map(t => (
                          <TaskCard key={t.id} task={t}
                            onToggle={toggleDone} onDelete={deleteTask}
                            onChangePriority={changePriority}
                            onLongPress={setReschedulingId} />
                        ))}
                      </div>
                    ))
                  : sortedTasks.map(t => (
                      <TaskCard key={t.id} task={t}
                        onToggle={toggleDone} onDelete={deleteTask}
                        onChangePriority={changePriority}
                        onLongPress={setReschedulingId} />
                    ))
                }
              </SortableContext>
            </DndContext>
            {tasks.length === 0 && <div className="empty">No tasks yet — add one below</div>}
          </div>

          <div className="input-area">
            <div className="input-row">
              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add a task..." />
              <button className="add-btn" onClick={addTask}>+</button>
            </div>
           <div className="input-meta">
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                className="time-input" />
              <select value={newRecurrence} onChange={e => setNewRecurrence(e.target.value)}
                className="recurrence-select">
                <option value="">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </>
      )}

      {activeTab === 'braindump' && (
        <BrainDump onAccept={acceptBrainDumpTask} />
      )}

      {activeTab === 'journal' && (
        <Journal user={user} />
      )}

      <nav className="tab-bar">
        <button className={`tab-btn${activeTab === 'braindump' ? ' active' : ''}`} onClick={() => setActiveTab('braindump')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21h6"/>
            <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4.5-3 6H9c-1.5-1.5-3-3.5-3-6a6 6 0 0 1 6-6z"/>
            <path d="M9 17v1a3 3 0 0 0 6 0v-1"/>
          </svg>
          <span>Dump</span>
        </button>
        <button className={`tab-btn${activeTab === 'tasks' ? ' active' : ''}`} onClick={() => setActiveTab('tasks')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <polyline points="3 6 4 7 6 5"/>
            <polyline points="3 12 4 13 6 11"/>
            <polyline points="3 18 4 19 6 17"/>
          </svg>
          <span>Tasks</span>
        </button>
        <button className={`tab-btn${activeTab === 'journal' ? ' active' : ''}`} onClick={() => setActiveTab('journal')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span>Journal</span>
        </button>
      </nav>

      {reschedulingId && (
        <TaskDetailSheet
          task={tasks.find(t => t.id === reschedulingId)}
          onSave={(fields) => saveTaskDetails(reschedulingId, fields)}
          onClose={() => setReschedulingId(null)}
        />
      )}

      {deletingTask && (
        <div className="sheet-backdrop" onClick={() => setDeletingTask(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Delete recurring task</div>
            <div className="sheet-task-name">{deletingTask.text}</div>
            <div className="sheet-options">
              <button className="sheet-option" onClick={() => {
                removeOccurrence(deletingTask.id)
                setDeletingTask(null)
              }}>
                <span className="sheet-option-label">This occurrence</span>
                <span className="sheet-option-sub">Only {dateFromKey(deletingTask.date_key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
              </button>
              <button className="sheet-option sheet-option-danger" onClick={() => deleteSeries(deletingTask)}>
                <span className="sheet-option-label">All occurrences</span>
                <span className="sheet-option-sub">Delete the entire series</span>
              </button>
            </div>
            <button className="sheet-cancel" onClick={() => setDeletingTask(null)}>Cancel</button>
          </div>
        </div>
      )}

      {showMonth && (
        <MonthView
          tasksByDay={tasksByDay}
          initialDate={(() => {
            // GMT+7 "today + dayOffset" as a local Date for the calendar grid.
            const s = new Date(Date.now() + TZ_OFFSET_MS)
            return new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + dayOffset)
          })()}
          onClose={() => setShowMonth(false)}
          onSelectDay={(date) => {
            const s = new Date(Date.now() + TZ_OFFSET_MS)
            const today = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())
            date.setHours(0, 0, 0, 0)
            const diff = Math.round((date - today) / 86400000)
            setDayOffset(diff)
            setShowMonth(false)
          }}
        />
      )}
    </div>
  )
}
