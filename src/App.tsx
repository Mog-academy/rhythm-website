import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DesktopShell } from './layout/DesktopShell'

const TimelinePage = lazy(() => import('./pages/TimelinePage').then((m) => ({ default: m.TimelinePage })))
const WeekPage = lazy(() => import('./pages/WeekPage').then((m) => ({ default: m.WeekPage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function RouteFallback() {
  return <section className="panel placeholder-page">Loading...</section>
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<DesktopShell />}>
          <Route index element={<Navigate to="/timeline" replace />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/timeline" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
