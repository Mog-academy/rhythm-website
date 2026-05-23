import { useMemo, useState } from 'react'
import {
  addDays,
  durationLabel,
  formatDateISO,
  formatTime,
  getDayLabel,
  getStartOfWeekSaturday,
  useRhythmActions,
  useRhythmState,
} from '../state/rhythmState'

export function WeekPage() {
  const state = useRhythmState()
  const actions = useRhythmActions()

  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()))
  const [selectedWeeklyTaskId, setSelectedWeeklyTaskId] = useState(state.weeklyTasks[0]?.id ?? '')
  const [startHour, setStartHour] = useState('09')
  const [startMinute, setStartMinute] = useState('00')
  const [bulletDrafts, setBulletDrafts] = useState<Record<string, string>>({})

  const weekStart = useMemo(() => getStartOfWeekSaturday(selectedDate), [selectedDate])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const selectedWeeklyTask =
    state.weeklyTasks.find((task) => task.id === selectedWeeklyTaskId) ?? null

  function scheduleForDay(dateISO: string) {
    if (!selectedWeeklyTask) return
    const hh = Number.parseInt(startHour, 10)
    const mm = Number.parseInt(startMinute, 10)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return

    actions.scheduleTaskOnDate({
      dateISO,
      task: selectedWeeklyTask,
      startHour: hh,
      startMinute: mm,
      listType: 'weekly',
    })
  }

  function saveBullets(dateISO: string, instanceId: string) {
    const key = `${dateISO}:${instanceId}`
    const raw = bulletDrafts[key] ?? ''
    const bullets = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    actions.updateScheduledBullets({
      dateISO,
      instanceId,
      listType: 'weekly',
      bulletPoints: bullets,
    })
  }

  return (
    <section className="week-page">
      <article className="panel week-toolbar">
        <div className="day-nav">
          <button onClick={() => setSelectedDate((d) => addDays(d, -7))}>Previous Week</button>
          <div className="date-pill">Week of {getDayLabel(weekStart)}</div>
          <button onClick={() => setSelectedDate((d) => addDays(d, 7))}>Next Week</button>
          <button onClick={() => setSelectedDate(formatDateISO(new Date()))}>Today</button>
        </div>

        <div className="create-row">
          <select
            value={selectedWeeklyTaskId}
            onChange={(e) => setSelectedWeeklyTaskId(e.target.value)}
          >
            {state.weeklyTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <input
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
            maxLength={2}
            placeholder="HH"
          />
          <input
            value={startMinute}
            onChange={(e) => setStartMinute(e.target.value)}
            maxLength={2}
            placeholder="MM"
          />
        </div>
      </article>

      <div className="week-grid">
        {weekDays.map((dateISO, dateIndex) => {
          const scheduled = state.weeklyTasksByDate[dateISO] ?? []

          return (
            <article key={dateISO} className="panel day-column">
              <header className="day-column-header">
                <strong>{getDayLabel(dateISO)}</strong>
                <button onClick={() => scheduleForDay(dateISO)} disabled={!selectedWeeklyTask}>
                  Add
                </button>
              </header>

              <ul className="task-list">
                {scheduled.map((item, index) => {
                  const bulletKey = `${dateISO}:${item.instanceId}`
                  const draft =
                    bulletDrafts[bulletKey] ??
                    (item.bulletPoints.length > 0 ? item.bulletPoints.join('\n') : '')

                  return (
                    <li key={item.instanceId} className="task-list-item week-task-item">
                      <div>
                        <strong>{item.task.title}</strong>
                        <p className="muted">
                          {formatTime(item.startHour, item.startMinute)} · {durationLabel(item.task.durationMinutes)}
                        </p>
                      </div>

                      <div className="inline-actions">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={item.isCompleted}
                            onChange={(e) =>
                              actions.toggleScheduledCompletion({
                                dateISO,
                                instanceId: item.instanceId,
                                listType: 'weekly',
                                completed: e.target.checked,
                              })
                            }
                          />
                          Done
                        </label>
                        <button
                          onClick={() =>
                            actions.moveScheduledTask({
                              dateISO,
                              instanceId: item.instanceId,
                              listType: 'weekly',
                              direction: -1,
                            })
                          }
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          onClick={() =>
                            actions.moveScheduledTask({
                              dateISO,
                              instanceId: item.instanceId,
                              listType: 'weekly',
                              direction: 1,
                            })
                          }
                          disabled={index === scheduled.length - 1}
                        >
                          Down
                        </button>
                        <button
                          onClick={() => {
                            if (dateIndex <= 0) return
                            actions.deleteScheduledTask({
                              dateISO,
                              instanceId: item.instanceId,
                              listType: 'weekly',
                            })
                            actions.scheduleTaskOnDate({
                              dateISO: weekDays[dateIndex - 1],
                              task: item.task,
                              startHour: item.startHour,
                              startMinute: item.startMinute,
                              listType: 'weekly',
                            })
                          }}
                          disabled={dateIndex === 0}
                        >
                          ← Day
                        </button>
                        <button
                          onClick={() => {
                            if (dateIndex >= weekDays.length - 1) return
                            actions.deleteScheduledTask({
                              dateISO,
                              instanceId: item.instanceId,
                              listType: 'weekly',
                            })
                            actions.scheduleTaskOnDate({
                              dateISO: weekDays[dateIndex + 1],
                              task: item.task,
                              startHour: item.startHour,
                              startMinute: item.startMinute,
                              listType: 'weekly',
                            })
                          }}
                          disabled={dateIndex === weekDays.length - 1}
                        >
                          Day →
                        </button>
                        <button
                          onClick={() =>
                            actions.deleteScheduledTask({
                              dateISO,
                              instanceId: item.instanceId,
                              listType: 'weekly',
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>

                      <textarea
                        className="bullet-editor"
                        placeholder="Bullet points, one per line"
                        value={draft}
                        onChange={(e) =>
                          setBulletDrafts((prev) => ({
                            ...prev,
                            [bulletKey]: e.target.value,
                          }))
                        }
                      />
                      <button onClick={() => saveBullets(dateISO, item.instanceId)}>Save Bullets</button>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
