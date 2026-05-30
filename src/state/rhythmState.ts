import { createContext, useContext } from 'react'
import type {
  DayOfWeek,
  PrayerTime,
  PrayerSettings,
  ReminderSettings,
  RhythmState,
  ScheduledTask,
  SleepSettings,
  Task,
  TaskCategory,
} from '../models/rhythm'

export function formatDateISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateISO(dateISO: string) {
  const [year, month, day] = dateISO.split('-').map((part) => Number.parseInt(part, 10))
  return new Date(year, month - 1, day)
}

const TODAY = formatDateISO(new Date())

const sampleTask: Task = {
  id: 'task-1',
  title: 'Deep Work Sprint',
  durationMinutes: 90,
  icon: 'task',
  category: 'FOCUS',
  customColorArgb: null,
  recurringDays: [],
}

const sampleWeeklyTask: Task = {
  id: 'task-weekly-1',
  title: 'Weekly Planning',
  durationMinutes: 60,
  icon: 'task',
  category: 'DEFAULT',
  customColorArgb: null,
  recurringDays: ['SUNDAY'],
}

export const seedState: RhythmState = {
  libraryTasks: [sampleTask],
  weeklyTasks: [sampleWeeklyTask],
  userTasksByDate: {
    [TODAY]: [
      {
        instanceId: 'inst-1',
        task: sampleTask,
        startHour: 9,
        startMinute: 0,
        isCompleted: false,
        subTasks: [],
        bulletPoints: [],
        bulletPointCompleted: [],
      },
    ],
  },
  weeklyTasksByDate: {},
  defaultSleepSettings: {
    durationMinutes: 480,
    wakeBeforeFajrMinutes: 10,
    sleepAfterIshaMinutes: 30,
  },
  sleepSettingsByDate: {},
  prayerTimesByDate: {
    [TODAY]: [
      { name: 'FAJR', hour: 4, minute: 30 },
      { name: 'DHUHR', hour: 12, minute: 15 },
      { name: 'ASR', hour: 15, minute: 45 },
      { name: 'MAGHRIB', hour: 17, minute: 50 },
      { name: 'ISHA', hour: 19, minute: 20 },
    ],
  },
  islamicDateByDate: {},
  islamicOccasionByDate: {},
  prayerSettings: {
    calculationMethod: 16,
    locationMode: 'DEVICE',
    manualLatitude: 25.2048,
    manualLongitude: 55.2708,
  },
  reminderSettings: {
    prayerAndSleepNotificationsEnabled: false,
    taskNotificationsEnabled: true,
  },
}

export const RhythmStateContext = createContext<RhythmState>(seedState)

export interface NewTaskInput {
  title: string
  durationMinutes: number
  icon: string
  category: TaskCategory
  customColorArgb: number | null
  recurringDays: DayOfWeek[]
}

export interface RhythmActions {
  addLibraryTask: (input: NewTaskInput) => void
  updateLibraryTask: (task: Task) => void
  deleteLibraryTask: (taskId: string) => void
  addWeeklyTask: (input: NewTaskInput) => void
  updateWeeklyTask: (task: Task) => void
  deleteWeeklyTask: (taskId: string) => void
  scheduleTaskOnDate: (args: {
    dateISO: string
    task: Task
    startHour: number
    startMinute: number
    listType: 'user' | 'weekly'
  }) => void
  toggleScheduledCompletion: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    completed: boolean
  }) => void
  deleteScheduledTask: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
  }) => void
  moveScheduledTask: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    direction: -1 | 1
  }) => void
  rescheduleScheduledTask: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    startHour: number
    startMinute: number
  }) => void
  moveScheduledTaskToDate: (args: {
    fromDateISO: string
    toDateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    startHour: number
    startMinute: number
    durationMinutes?: number
  }) => void
  updateScheduledTaskTiming: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    startHour: number
    startMinute: number
    durationMinutes: number
  }) => void
  updateScheduledBullets: (args: {
    dateISO: string
    instanceId: string
    listType: 'user' | 'weekly'
    bulletPoints: string[]
  }) => void
  setPrayerSettings: (settings: PrayerSettings) => void
  setReminderSettings: (settings: ReminderSettings) => void
  setDefaultSleepSettings: (settings: SleepSettings) => void
  setSleepSettingsForDate: (dateISO: string, settings: SleepSettings) => void
  setPrayerTimesForDate: (dateISO: string, prayerTimes: PrayerTime[]) => void
  setIslamicDateForDate: (dateISO: string, hijriDateLabel: string | null) => void
  setIslamicOccasionForDate: (dateISO: string, occasion: string | null) => void
}

const noOpActions: RhythmActions = {
  addLibraryTask: () => {},
  updateLibraryTask: () => {},
  deleteLibraryTask: () => {},
  addWeeklyTask: () => {},
  updateWeeklyTask: () => {},
  deleteWeeklyTask: () => {},
  scheduleTaskOnDate: () => {},
  toggleScheduledCompletion: () => {},
  deleteScheduledTask: () => {},
  moveScheduledTask: () => {},
  rescheduleScheduledTask: () => {},
  moveScheduledTaskToDate: () => {},
  updateScheduledTaskTiming: () => {},
  updateScheduledBullets: () => {},
  setPrayerSettings: () => {},
  setReminderSettings: () => {},
  setDefaultSleepSettings: () => {},
  setSleepSettingsForDate: () => {},
  setPrayerTimesForDate: () => {},
  setIslamicDateForDate: () => {},
  setIslamicOccasionForDate: () => {},
}

export const RhythmActionsContext = createContext<RhythmActions>(noOpActions)

export function useRhythmState() {
  return useContext(RhythmStateContext)
}

export function useRhythmActions() {
  return useContext(RhythmActionsContext)
}

export function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getStartOfWeekSaturday(dateISO: string) {
  const date = parseDateISO(dateISO)
  const day = date.getDay() // 0 Sun ... 6 Sat
  const daysFromSaturday = (day + 1) % 7
  date.setDate(date.getDate() - daysFromSaturday)
  return formatDateISO(date)
}

export function addDays(dateISO: string, days: number) {
  const d = parseDateISO(dateISO)
  d.setDate(d.getDate() + days)
  return formatDateISO(d)
}

export function isAutoTaskId(taskId: string) {
  return taskId.startsWith('auto-prayer-') || taskId.startsWith('auto-sleep-')
}

export function getDayLabel(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(hour: number, minute: number) {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m === 0) return `${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function toMinutes(hour: number, minute: number) {
  return hour * 60 + minute
}

function fromMinutes(total: number) {
  const safe = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return {
    startHour: Math.floor(safe / 60),
    startMinute: safe % 60,
  }
}

function buildAutoPrayerTasks(prayerTimes: PrayerTime[]): ScheduledTask[] {
  const durationByPrayer: Record<PrayerTime['name'], number> = {
    FAJR: 40,
    DHUHR: 30,
    ASR: 30,
    MAGHRIB: 15,
    ISHA: 30,
  }

  return prayerTimes.map((prayer) => {
    const isFridayDhuhr = new Date().getDay() === 5 && prayer.name === 'DHUHR'
    const title = isFridayDhuhr ? 'Friday Prayer Time' : `${prayer.name} Prayer Time`
    const duration = isFridayDhuhr ? 30 : durationByPrayer[prayer.name]

    return {
      instanceId: `auto-prayer-${prayer.name.toLowerCase()}`,
      task: {
        id: `auto-prayer-${prayer.name.toLowerCase()}`,
        title,
        durationMinutes: duration,
        icon: 'mosque',
        category: 'DEFAULT',
        customColorArgb: null,
        recurringDays: [],
      },
      startHour: isFridayDhuhr ? 12 : prayer.hour,
      startMinute: isFridayDhuhr ? 30 : prayer.minute,
      isCompleted: false,
      subTasks: [],
      bulletPoints: [],
      bulletPointCompleted: [],
    }
  })
}

function buildAutoSleepTask(prayerTimes: PrayerTime[], sleepSettings: SleepSettings): ScheduledTask[] {
  const fajr = prayerTimes.find((p) => p.name === 'FAJR')
  const isha = prayerTimes.find((p) => p.name === 'ISHA')
  if (!fajr || !isha) return []

  const ishaEnd = toMinutes(isha.hour, isha.minute) + 30
  const sleepStart = ishaEnd + sleepSettings.sleepAfterIshaMinutes
  const fajrStart = toMinutes(fajr.hour, fajr.minute)
  let sleepEnd = fajrStart - sleepSettings.wakeBeforeFajrMinutes

  if (sleepEnd <= sleepStart) {
    sleepEnd += 24 * 60
  }

  const duration = Math.max(30, sleepEnd - sleepStart)
  const start = fromMinutes(sleepStart)

  return [
    {
      instanceId: 'auto-sleep-main',
      task: {
        id: 'auto-sleep-main',
        title: 'Sleep Time',
        durationMinutes: duration,
        icon: 'bedtime',
        category: 'DEFAULT',
        customColorArgb: -16777216,
        recurringDays: [],
      },
      startHour: start.startHour,
      startMinute: start.startMinute,
      isCompleted: false,
      subTasks: [],
      bulletPoints: [],
      bulletPointCompleted: [],
    },
  ]
}

export function getMergedScheduleForDate(state: RhythmState, dateISO: string): ScheduledTask[] {
  const userTasks = (state.userTasksByDate[dateISO] ?? []).filter((item) => !isAutoTaskId(item.task.id))
  const weeklyTasks = (state.weeklyTasksByDate[dateISO] ?? []).filter(
    (item) => !isAutoTaskId(item.task.id),
  )
  const prayerTimes = state.prayerTimesByDate[dateISO] ?? []
  const sleepSettings = state.sleepSettingsByDate[dateISO] ?? state.defaultSleepSettings

  const autoPrayer = buildAutoPrayerTasks(prayerTimes)
  const autoSleep = buildAutoSleepTask(prayerTimes, sleepSettings)

  return [...userTasks, ...weeklyTasks, ...autoPrayer, ...autoSleep].sort((a, b) => {
    return toMinutes(a.startHour, a.startMinute) - toMinutes(b.startHour, b.startMinute)
  })
}
