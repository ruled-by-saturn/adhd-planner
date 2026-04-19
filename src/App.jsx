import { useState, useRef, useEffect } from 'react'
import { RescheduleSheet } from './RescheduleSheet'
import { MonthView } from './MonthView'
import { Auth } from './Auth'
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

const PRIORITIES = ['Now', 'Soon', 'Someday']

function getDateKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function formatDay(offset) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatDate(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function App() {
  const [dayOffset, setDayOffset] = useState(0)
  const [tasksByDay, setTasksByDay] = useState({})
  const [sortMode, setSortMode] = useState('priority')
  const [input, setInput] = useState('')
  const [newPriority, setNewPriority] = useState('Now')
  const [newTime, setNewTime] = useState('')
  const [showMonth, setShowMonth] = useState(false)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const inputRef = useRef(null)
  const touchStartX = useRef(null)

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
  setTasksByDay(byDay)
  setLoading(false)
}

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
    }
    setTasks([...tasks, task])
    setInput('')
    setNewTime('')
    await supabase.from('tasks').insert(task)
  }

  async function toggleDone(id) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
    await supabase.from('tasks').update({ done: !task.done }).eq('id', id)
  }

  async function deleteTask(id) {
    setTasks(tasks.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function changePriority(id, priority) {
    setTasks(tasks.map(t => t.id === id ? { ...t, priority } : t))
    await supabase.from('tasks').update({ priority }).eq('id', id)
  }

  async function rescheduleTask(taskId, targetDateKey) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const targetTasks = tasksByDay[targetDateKey] || []
    setTasksByDay(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(t => t.id !== taskId),
      [targetDateKey]: [...targetTasks, { ...task, date_key: targetDateKey }],
    }))
    setReschedulingId(null)
    await supabase.from('tasks')
      .update({ date_key: targetDateKey, position: targetTasks.length })
      .eq('id', taskId)
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

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) setDayOffset(o => o + (diff > 0 ? 1 : -1))
    touchStartX.current = null
  }

  const grouped = PRIORITIES.reduce((acc, p) => {
    acc[p] = sortedTasks.filter(t => t.priority === p)
    return acc
  }, {})

  if (loading) return <div className="loading">Loading...</div>
  if (!user) return <Auth />

    if (loading) return <div className="loading">Loading...</div>
  if (!user) return <Auth />

  return (
    <div className="app" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="topbar">
        
        <div className="day-nav">
          <button className="nav-btn" onClick={() => setDayOffset(o => o - 1)}>‹</button>
          <div className="day-info">
            <div className="day-label">{formatDay(dayOffset)}</div>
            <div className="date-sub">{formatDate(dayOffset)}</div>
          </div>
          <button className="nav-btn" onClick={() => setDayOffset(o => o + 1)}>›</button>
          <button className="month-btn" onClick={() => setShowMonth(true)}>📅</button>
        </div>
        <div className="sort-toggle">
          <button className="signout-btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
          <button className={sortMode === 'priority' ? 'sort-btn active' : 'sort-btn'}
            onClick={() => setSortMode('priority')}>Priority</button>
          <button className={sortMode === 'chrono' ? 'sort-btn active' : 'sort-btn'}
            onClick={() => setSortMode('chrono')}>Chronological</button> 
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
        {tasks.length === 0 && (
          <div className="empty">No tasks yet — add one below</div>
        )}
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
        </div>
      </div>

      {reschedulingId && (
        <RescheduleSheet
          taskText={tasks.find(t => t.id === reschedulingId)?.text}
          onReschedule={(date) => rescheduleTask(reschedulingId, date)}
          onClose={() => setReschedulingId(null)}
        />
      )}

      {showMonth && (
        <MonthView
          tasksByDay={tasksByDay}
          initialDate={(() => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d })()}
          onClose={() => setShowMonth(false)}
          onSelectDay={(date) => {
            const today = new Date()
            today.setHours(0,0,0,0)
            date.setHours(0,0,0,0)
            const diff = Math.round((date - today) / 86400000)
            setDayOffset(diff)
            setShowMonth(false)
          }}
        />
      )}
    </div>
  )
}