export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type TaskCategory = 'DEFAULT' | 'FOCUS' | 'MEETING' | 'PERSONAL'

export type PrayerName = 'FAJR' | 'DHUHR' | 'ASR' | 'MAGHRIB' | 'ISHA'

export interface Task {
  id: string
  title: string
  durationMinutes: number
  icon: string
  category: TaskCategory
  customColorArgb: number | null
  recurringDays: DayOfWeek[]
}

export interface ScheduledTask {
  instanceId: string
  task: Task
  startHour: number
  startMinute: number
  isCompleted: boolean
  subTasks: Task[]
  bulletPoints: string[]
  bulletPointCompleted: boolean[]
}

export interface PrayerTime {
  name: PrayerName
  hour: number
  minute: number
}

export interface SleepSettings {
  durationMinutes: number
  wakeBeforeFajrMinutes: number
  sleepAfterIshaMinutes: number
}

export interface PrayerSettings {
  calculationMethod: number
  locationMode: 'DEVICE' | 'MANUAL'
  manualLatitude: number
  manualLongitude: number
}

export interface ReminderSettings {
  prayerAndSleepNotificationsEnabled: boolean
  taskNotificationsEnabled: boolean
}

export interface RhythmState {
  libraryTasks: Task[]
  weeklyTasks: Task[]
  userTasksByDate: Record<string, ScheduledTask[]>
  weeklyTasksByDate: Record<string, ScheduledTask[]>
  defaultSleepSettings: SleepSettings
  sleepSettingsByDate: Record<string, SleepSettings>
  prayerTimesByDate: Record<string, PrayerTime[]>
  islamicDateByDate: Record<string, string | null>
  islamicOccasionByDate: Record<string, string | null>
  prayerSettings: PrayerSettings
  reminderSettings: ReminderSettings
}
