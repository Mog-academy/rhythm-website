import { useMemo, useState } from 'react'
import { addDays, durationLabel, formatDateISO, useRhythmState } from '../state/rhythmState'

type StatsRange = 'TODAY' | 'WEEK' | 'MONTH'

function getRangeDates(range: StatsRange) {
  const today = formatDateISO(new Date())
  if (range === 'TODAY') return [today]

  if (range === 'WEEK') {
    return Array.from({ length: 7 }, (_, index) => addDays(today, -index))
  }

  return Array.from({ length: 30 }, (_, index) => addDays(today, -index))
}

export function StatsPage() {
  const state = useRhythmState()
  const [range, setRange] = useState<StatsRange>('TODAY')

  const metrics = useMemo(() => {
    const dates = getRangeDates(range)
    const allScheduled = dates.flatMap((dateISO) => [
      ...(state.userTasksByDate[dateISO] ?? []),
      ...(state.weeklyTasksByDate[dateISO] ?? []),
    ])

    const total = allScheduled.length
    const completed = allScheduled.filter((item) => item.isCompleted).length
    const pending = total - completed
    const totalMinutes = allScheduled.reduce((sum, item) => sum + item.task.durationMinutes, 0)
    const completedMinutes = allScheduled
      .filter((item) => item.isCompleted)
      .reduce((sum, item) => sum + item.task.durationMinutes, 0)

    const byCategory = allScheduled.reduce<Record<string, number>>((acc, item) => {
      acc[item.task.category] = (acc[item.task.category] ?? 0) + 1
      return acc
    }, {})

    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100)

    return {
      total,
      completed,
      pending,
      totalMinutes,
      completedMinutes,
      completionRate,
      byCategory,
    }
  }, [range, state.userTasksByDate, state.weeklyTasksByDate])

  return (
    <section className="stats-page">
      <article className="panel stats-header-panel">
        <h2>Analytics & Trends</h2>
        <div className="inline-actions">
          <button onClick={() => setRange('TODAY')} disabled={range === 'TODAY'}>
            Today
          </button>
          <button onClick={() => setRange('WEEK')} disabled={range === 'WEEK'}>
            7 Days
          </button>
          <button onClick={() => setRange('MONTH')} disabled={range === 'MONTH'}>
            30 Days
          </button>
        </div>
      </article>

      <div className="stats-grid">
        <article className="panel stats-card">
          <h3>Total Scheduled</h3>
          <strong>{metrics.total}</strong>
        </article>
        <article className="panel stats-card">
          <h3>Completed</h3>
          <strong>{metrics.completed}</strong>
        </article>
        <article className="panel stats-card">
          <h3>Pending</h3>
          <strong>{metrics.pending}</strong>
        </article>
        <article className="panel stats-card">
          <h3>Completion Rate</h3>
          <strong>{metrics.completionRate}%</strong>
        </article>
      </div>

      <article className="panel stats-detail-panel">
        <h3>Duration Summary</h3>
        <p className="muted">Total: {durationLabel(metrics.totalMinutes)}</p>
        <p className="muted">Completed: {durationLabel(metrics.completedMinutes)}</p>
      </article>

      <article className="panel stats-detail-panel">
        <h3>Category Breakdown</h3>
        {Object.keys(metrics.byCategory).length === 0 ? (
          <p className="muted">No data in selected range.</p>
        ) : (
          <ul className="task-list">
            {Object.entries(metrics.byCategory).map(([category, count]) => (
              <li key={category} className="task-list-item">
                <strong>{category}</strong>
                <span>{count} tasks</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
