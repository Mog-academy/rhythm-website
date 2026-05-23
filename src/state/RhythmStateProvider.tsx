import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { firebaseAuth, firebaseDb, firebaseEnabled, firebaseSharedSyncDocId } from '../firebase/config'
import type { NewTaskInput, RhythmActions } from './rhythmState'
import type { RhythmState, ScheduledTask, Task } from '../models/rhythm'
import { FirebaseSyncManager } from '../sync/FirebaseSyncManager'
import {
  generateId,
  RhythmActionsContext,
  RhythmStateContext,
  seedState,
} from './rhythmState'

const RHYTHM_PREFS_KEY = 'main_screen_state_v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeState(value: unknown): RhythmState | null {
  if (!isRecord(value)) return null

  const candidate = value as Partial<RhythmState>

  return {
    ...seedState,
    ...candidate,
    libraryTasks: Array.isArray(candidate.libraryTasks) ? candidate.libraryTasks : seedState.libraryTasks,
    weeklyTasks: Array.isArray(candidate.weeklyTasks) ? candidate.weeklyTasks : seedState.weeklyTasks,
    userTasksByDate: isRecord(candidate.userTasksByDate) ? candidate.userTasksByDate : {},
    weeklyTasksByDate: isRecord(candidate.weeklyTasksByDate) ? candidate.weeklyTasksByDate : {},
    sleepSettingsByDate: isRecord(candidate.sleepSettingsByDate) ? candidate.sleepSettingsByDate : {},
    prayerTimesByDate: isRecord(candidate.prayerTimesByDate) ? candidate.prayerTimesByDate : {},
    islamicDateByDate: isRecord(candidate.islamicDateByDate) ? candidate.islamicDateByDate : {},
    islamicOccasionByDate: isRecord(candidate.islamicOccasionByDate)
      ? candidate.islamicOccasionByDate
      : {},
    defaultSleepSettings: {
      ...seedState.defaultSleepSettings,
      ...(isRecord(candidate.defaultSleepSettings) ? candidate.defaultSleepSettings : {}),
    },
    prayerSettings: {
      ...seedState.prayerSettings,
      ...(isRecord(candidate.prayerSettings) ? candidate.prayerSettings : {}),
    },
    reminderSettings: {
      ...seedState.reminderSettings,
      ...(isRecord(candidate.reminderSettings) ? candidate.reminderSettings : {}),
    },
  }
}

function safeParseState(raw: string | null): RhythmState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return normalizeState(parsed)
  } catch {
    return null
  }
}

export function RhythmStateProvider({ children }: { children: ReactNode }) {
  const initialState = useMemo(() => {
    const local = safeParseState(localStorage.getItem(RHYTHM_PREFS_KEY))
    return local ?? seedState
  }, [])

  const [state, setState] = useState<RhythmState>(initialState)
  const shouldSkipNextUpload = useRef(false)
  const syncManagerRef = useRef<FirebaseSyncManager | null>(null)

  const actions = useMemo<RhythmActions>(() => {
    const createTask = (input: NewTaskInput): Task => ({
      id: generateId('task'),
      title: input.title.trim(),
      durationMinutes: Math.max(1, input.durationMinutes),
      icon: input.icon.trim() || 'task',
      category: input.category,
      customColorArgb: input.customColorArgb,
      recurringDays: input.recurringDays,
    })

    const appendTaskTo = (list: Task[], input: NewTaskInput) => [...list, createTask(input)]

    const toMinutes = (hour: number, minute: number) => hour * 60 + minute

    return {
      addLibraryTask: (input) => {
        setState((prev) => ({
          ...prev,
          libraryTasks: appendTaskTo(prev.libraryTasks, input),
        }))
      },
      updateLibraryTask: (task) => {
        setState((prev) => ({
          ...prev,
          libraryTasks: prev.libraryTasks.map((t) => (t.id === task.id ? task : t)),
        }))
      },
      deleteLibraryTask: (taskId) => {
        setState((prev) => ({
          ...prev,
          libraryTasks: prev.libraryTasks.filter((t) => t.id !== taskId),
        }))
      },
      addWeeklyTask: (input) => {
        setState((prev) => ({
          ...prev,
          weeklyTasks: appendTaskTo(prev.weeklyTasks, input),
        }))
      },
      updateWeeklyTask: (task) => {
        setState((prev) => ({
          ...prev,
          weeklyTasks: prev.weeklyTasks.map((t) => (t.id === task.id ? task : t)),
        }))
      },
      deleteWeeklyTask: (taskId) => {
        setState((prev) => ({
          ...prev,
          weeklyTasks: prev.weeklyTasks.filter((t) => t.id !== taskId),
        }))
      },
      scheduleTaskOnDate: ({ dateISO, task, startHour, startMinute, listType }) => {
        const h = Math.max(0, Math.min(23, startHour))
        const m = Math.max(0, Math.min(59, startMinute))

        const scheduledTask: ScheduledTask = {
          instanceId: generateId('scheduled'),
          task: {
            ...task,
            durationMinutes: Math.max(1, task.durationMinutes),
          },
          startHour: h,
          startMinute: m,
          isCompleted: false,
          subTasks: [],
          bulletPoints: [],
          bulletPointCompleted: [],
        }

        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []
          const next = [...existing, scheduledTask].sort(
            (a, b) => toMinutes(a.startHour, a.startMinute) - toMinutes(b.startHour, b.startMinute),
          )
          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: next,
            },
          }
        })
      },
      toggleScheduledCompletion: ({ dateISO, instanceId, listType, completed }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []
          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: existing.map((item) =>
                item.instanceId === instanceId
                  ? {
                      ...item,
                      isCompleted: completed,
                      bulletPointCompleted: item.bulletPoints.map(() => completed),
                    }
                  : item,
              ),
            },
          }
        })
      },
      deleteScheduledTask: ({ dateISO, instanceId, listType }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []
          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: existing.filter((item) => item.instanceId !== instanceId),
            },
          }
        })
      },
      moveScheduledTask: ({ dateISO, instanceId, listType, direction }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = [...(prev[key][dateISO] ?? [])]
          const index = existing.findIndex((item) => item.instanceId === instanceId)
          if (index < 0) return prev

          const nextIndex = index + direction
          if (nextIndex < 0 || nextIndex >= existing.length) return prev

          const [moved] = existing.splice(index, 1)
          existing.splice(nextIndex, 0, moved)

          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: existing,
            },
          }
        })
      },
      rescheduleScheduledTask: ({ dateISO, instanceId, listType, startHour, startMinute }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []
          const hh = Math.max(0, Math.min(23, startHour))
          const mm = Math.max(0, Math.min(59, startMinute))

          const next = existing
            .map((item) =>
              item.instanceId === instanceId
                ? {
                    ...item,
                    startHour: hh,
                    startMinute: mm,
                  }
                : item,
            )
            .sort(
              (a, b) =>
                a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
            )

          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: next,
            },
          }
        })
      },
      moveScheduledTaskToDate: ({
        fromDateISO,
        toDateISO,
        instanceId,
        listType,
        startHour,
        startMinute,
        durationMinutes,
      }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const fromExisting = prev[key][fromDateISO] ?? []
          const toExisting = prev[key][toDateISO] ?? []
          const moving = fromExisting.find((item) => item.instanceId === instanceId)
          if (!moving) return prev

          const hh = Math.max(0, Math.min(23, startHour))
          const mm = Math.max(0, Math.min(59, startMinute))
          const nextDuration =
            typeof durationMinutes === 'number'
              ? Math.max(1, Math.round(durationMinutes))
              : moving.task.durationMinutes

          const moved = {
            ...moving,
            startHour: hh,
            startMinute: mm,
            task: {
              ...moving.task,
              durationMinutes: nextDuration,
            },
          }

          const nextFrom = fromExisting.filter((item) => item.instanceId !== instanceId)
          const nextTo = [...toExisting, moved].sort(
            (a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
          )

          return {
            ...prev,
            [key]: {
              ...prev[key],
              [fromDateISO]: nextFrom,
              [toDateISO]: nextTo,
            },
          }
        })
      },
      updateScheduledTaskTiming: ({
        dateISO,
        instanceId,
        listType,
        startHour,
        startMinute,
        durationMinutes,
      }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []
          const hh = Math.max(0, Math.min(23, startHour))
          const mm = Math.max(0, Math.min(59, startMinute))
          const nextDuration = Math.max(1, Math.round(durationMinutes))

          const next = existing
            .map((item) =>
              item.instanceId === instanceId
                ? {
                    ...item,
                    startHour: hh,
                    startMinute: mm,
                    task: {
                      ...item.task,
                      durationMinutes: nextDuration,
                    },
                  }
                : item,
            )
            .sort(
              (a, b) =>
                a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
            )

          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: next,
            },
          }
        })
      },
      updateScheduledBullets: ({ dateISO, instanceId, listType, bulletPoints }) => {
        setState((prev) => {
          const key = listType === 'weekly' ? 'weeklyTasksByDate' : 'userTasksByDate'
          const existing = prev[key][dateISO] ?? []

          const normalizedBullets = bulletPoints
            .map((item) => item.trim())
            .filter((item) => item.length > 0)

          const updated = existing.map((item) => {
            if (item.instanceId !== instanceId) return item
            const completion = normalizedBullets.map(
              (_, idx) => item.bulletPointCompleted[idx] ?? false,
            )
            return {
              ...item,
              bulletPoints: normalizedBullets,
              bulletPointCompleted: completion,
              isCompleted: normalizedBullets.length > 0 ? completion.every(Boolean) : item.isCompleted,
            }
          })

          return {
            ...prev,
            [key]: {
              ...prev[key],
              [dateISO]: updated,
            },
          }
        })
      },
      setPrayerSettings: (settings) => {
        setState((prev) => ({
          ...prev,
          prayerSettings: settings,
        }))
      },
      setReminderSettings: (settings) => {
        setState((prev) => ({
          ...prev,
          reminderSettings: settings,
        }))
      },
      setDefaultSleepSettings: (settings) => {
        setState((prev) => ({
          ...prev,
          defaultSleepSettings: settings,
        }))
      },
      setSleepSettingsForDate: (dateISO, settings) => {
        setState((prev) => ({
          ...prev,
          sleepSettingsByDate: {
            ...prev.sleepSettingsByDate,
            [dateISO]: settings,
          },
        }))
      },
      setPrayerTimesForDate: (dateISO, prayerTimes) => {
        setState((prev) => ({
          ...prev,
          prayerTimesByDate: {
            ...prev.prayerTimesByDate,
            [dateISO]: prayerTimes,
          },
        }))
      },
      setIslamicDateForDate: (dateISO, hijriDateLabel) => {
        setState((prev) => ({
          ...prev,
          islamicDateByDate: {
            ...prev.islamicDateByDate,
            [dateISO]: hijriDateLabel,
          },
        }))
      },
      setIslamicOccasionForDate: (dateISO, occasion) => {
        setState((prev) => ({
          ...prev,
          islamicOccasionByDate: {
            ...prev.islamicOccasionByDate,
            [dateISO]: occasion,
          },
        }))
      },
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(RHYTHM_PREFS_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!firebaseEnabled || !firebaseAuth || !firebaseDb) {
      return
    }

    const syncManager = new FirebaseSyncManager({
      auth: firebaseAuth,
      firestore: firebaseDb,
      sharedSyncDocId: firebaseSharedSyncDocId,
    })
    syncManagerRef.current = syncManager

    void syncManager.start((remoteJson) => {
      const remoteState = safeParseState(remoteJson)
      if (!remoteState) return
      shouldSkipNextUpload.current = true
      setState(remoteState)
    })

    return () => {
      syncManager.stop()
      syncManagerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!firebaseEnabled) {
      return
    }

    if (shouldSkipNextUpload.current) {
      shouldSkipNextUpload.current = false
      return
    }

    syncManagerRef.current?.scheduleUpload(JSON.stringify(state))
  }, [state])

  return (
    <RhythmStateContext.Provider value={state}>
      <RhythmActionsContext.Provider value={actions}>{children}</RhythmActionsContext.Provider>
    </RhythmStateContext.Provider>
  )
}
