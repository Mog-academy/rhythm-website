import { useMemo, useState } from 'react'
import type { DayOfWeek, TaskCategory } from '../models/rhythm'
import { durationLabel, useRhythmActions, useRhythmState } from '../state/rhythmState'

const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

function TaskEditor({
  title,
  duration,
  category,
  onTitle,
  onDuration,
  onCategory,
  recurringDays,
  onToggleDay,
}: {
  title: string
  duration: string
  category: TaskCategory
  onTitle: (value: string) => void
  onDuration: (value: string) => void
  onCategory: (value: TaskCategory) => void
  recurringDays: DayOfWeek[]
  onToggleDay: (day: DayOfWeek) => void
}) {
  return (
    <>
      <input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Task title" />
      <input
        value={duration}
        onChange={(e) => onDuration(e.target.value)}
        placeholder="Duration minutes"
      />
      <select value={category} onChange={(e) => onCategory(e.target.value as TaskCategory)}>
        <option value="DEFAULT">Default</option>
        <option value="FOCUS">Focus</option>
        <option value="MEETING">Meeting</option>
        <option value="PERSONAL">Personal</option>
      </select>
      <div className="days-row">
        {DAYS.map((day) => {
          const checked = recurringDays.includes(day)
          return (
            <label key={day}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleDay(day)}
              />
              {day.slice(0, 3)}
            </label>
          )
        })}
      </div>
    </>
  )
}

export function TasksPage() {
  const state = useRhythmState()
  const actions = useRhythmActions()

  const [libraryTitle, setLibraryTitle] = useState('')
  const [libraryDuration, setLibraryDuration] = useState('45')
  const [libraryCategory, setLibraryCategory] = useState<TaskCategory>('DEFAULT')
  const [libraryRecurringDays, setLibraryRecurringDays] = useState<DayOfWeek[]>([])

  const [weeklyTitle, setWeeklyTitle] = useState('')
  const [weeklyDuration, setWeeklyDuration] = useState('45')
  const [weeklyCategory, setWeeklyCategory] = useState<TaskCategory>('DEFAULT')
  const [weeklyRecurringDays, setWeeklyRecurringDays] = useState<DayOfWeek[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDuration, setEditingDuration] = useState('45')
  const [editingCategory, setEditingCategory] = useState<TaskCategory>('DEFAULT')

  const allTasksCount = useMemo(
    () => state.libraryTasks.length + state.weeklyTasks.length,
    [state.libraryTasks.length, state.weeklyTasks.length],
  )

  function toggleRecurringDay(days: DayOfWeek[], setDays: (d: DayOfWeek[]) => void, day: DayOfWeek) {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day))
    } else {
      setDays([...days, day])
    }
  }

  function createLibraryTask() {
    const title = libraryTitle.trim()
    const duration = Number.parseInt(libraryDuration, 10)
    if (!title || Number.isNaN(duration) || duration <= 0) return

    actions.addLibraryTask({
      title,
      durationMinutes: duration,
      icon: 'task',
      category: libraryCategory,
      customColorArgb: null,
      recurringDays: libraryRecurringDays,
    })

    setLibraryTitle('')
    setLibraryDuration('45')
    setLibraryCategory('DEFAULT')
    setLibraryRecurringDays([])
  }

  function createWeeklyTask() {
    const title = weeklyTitle.trim()
    const duration = Number.parseInt(weeklyDuration, 10)
    if (!title || Number.isNaN(duration) || duration <= 0) return

    actions.addWeeklyTask({
      title,
      durationMinutes: duration,
      icon: 'task',
      category: weeklyCategory,
      customColorArgb: null,
      recurringDays: weeklyRecurringDays,
    })

    setWeeklyTitle('')
    setWeeklyDuration('45')
    setWeeklyCategory('DEFAULT')
    setWeeklyRecurringDays([])
  }

  function startEdit(id: string, title: string, durationMinutes: number, category: TaskCategory) {
    setEditingId(id)
    setEditingTitle(title)
    setEditingDuration(String(durationMinutes))
    setEditingCategory(category)
  }

  function applyEditInLibrary() {
    if (!editingId) return
    const source = state.libraryTasks.find((task) => task.id === editingId)
    if (!source) return
    const nextDuration = Number.parseInt(editingDuration, 10)
    if (!editingTitle.trim() || Number.isNaN(nextDuration) || nextDuration <= 0) return

    actions.updateLibraryTask({
      ...source,
      title: editingTitle.trim(),
      durationMinutes: nextDuration,
      category: editingCategory,
    })
    setEditingId(null)
  }

  function applyEditInWeekly() {
    if (!editingId) return
    const source = state.weeklyTasks.find((task) => task.id === editingId)
    if (!source) return
    const nextDuration = Number.parseInt(editingDuration, 10)
    if (!editingTitle.trim() || Number.isNaN(nextDuration) || nextDuration <= 0) return

    actions.updateWeeklyTask({
      ...source,
      title: editingTitle.trim(),
      durationMinutes: nextDuration,
      category: editingCategory,
    })
    setEditingId(null)
  }

  return (
    <section className="tasks-page">
      <article className="panel tasks-create-panel">
        <h2>Tasks Catalog</h2>
        <p className="muted">{allTasksCount} tasks across library and weekly lists.</p>
      </article>

      <article className="panel tasks-create-panel">
        <h3>Create Library Task</h3>
        <TaskEditor
          title={libraryTitle}
          duration={libraryDuration}
          category={libraryCategory}
          onTitle={setLibraryTitle}
          onDuration={setLibraryDuration}
          onCategory={setLibraryCategory}
          recurringDays={libraryRecurringDays}
          onToggleDay={(day) => toggleRecurringDay(libraryRecurringDays, setLibraryRecurringDays, day)}
        />
        <button onClick={createLibraryTask}>Add Library Task</button>
      </article>

      <article className="panel tasks-create-panel">
        <h3>Create Weekly Task</h3>
        <TaskEditor
          title={weeklyTitle}
          duration={weeklyDuration}
          category={weeklyCategory}
          onTitle={setWeeklyTitle}
          onDuration={setWeeklyDuration}
          onCategory={setWeeklyCategory}
          recurringDays={weeklyRecurringDays}
          onToggleDay={(day) => toggleRecurringDay(weeklyRecurringDays, setWeeklyRecurringDays, day)}
        />
        <button onClick={createWeeklyTask}>Add Weekly Task</button>
      </article>

      <article className="panel tasks-list-panel">
        <h3>Library Tasks</h3>
        <ul className="task-list">
          {state.libraryTasks.map((task) => {
            const isEditing = editingId === task.id
            return (
              <li key={task.id} className="task-list-item">
                {isEditing ? (
                  <div className="task-edit-row">
                    <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                    <input
                      value={editingDuration}
                      onChange={(e) => setEditingDuration(e.target.value)}
                    />
                    <select
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value as TaskCategory)}
                    >
                      <option value="DEFAULT">Default</option>
                      <option value="FOCUS">Focus</option>
                      <option value="MEETING">Meeting</option>
                      <option value="PERSONAL">Personal</option>
                    </select>
                    <button onClick={applyEditInLibrary}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted">
                        {task.category} · {durationLabel(task.durationMinutes)}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button
                        onClick={() =>
                          startEdit(task.id, task.title, task.durationMinutes, task.category)
                        }
                      >
                        Edit
                      </button>
                      <button onClick={() => actions.deleteLibraryTask(task.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </article>

      <article className="panel tasks-list-panel">
        <h3>Weekly Tasks</h3>
        <ul className="task-list">
          {state.weeklyTasks.map((task) => {
            const isEditing = editingId === task.id
            return (
              <li key={task.id} className="task-list-item">
                {isEditing ? (
                  <div className="task-edit-row">
                    <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                    <input
                      value={editingDuration}
                      onChange={(e) => setEditingDuration(e.target.value)}
                    />
                    <select
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value as TaskCategory)}
                    >
                      <option value="DEFAULT">Default</option>
                      <option value="FOCUS">Focus</option>
                      <option value="MEETING">Meeting</option>
                      <option value="PERSONAL">Personal</option>
                    </select>
                    <button onClick={applyEditInWeekly}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted">
                        {task.category} · {durationLabel(task.durationMinutes)}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button
                        onClick={() =>
                          startEdit(task.id, task.title, task.durationMinutes, task.category)
                        }
                      >
                        Edit
                      </button>
                      <button onClick={() => actions.deleteWeeklyTask(task.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </article>
    </section>
  )
}
