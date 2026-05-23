import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPrayerDataForDate } from '../services/prayerTimesService'
import {
  addDays,
  durationLabel,
  formatDateISO,
  formatTime,
  generateId,
  getMergedScheduleForDate,
  isAutoTaskId,
  useRhythmActions,
  useRhythmState,
} from '../state/rhythmState'

const HOUR_HEIGHT = 64

interface DragPayload {
  type: 'library' | 'weeklyBullet' | 'scheduled'
  taskId?: string
  instanceId?: string
  bulletTitle?: string
  durationMinutes?: number
}

interface WindowScheduledItem {
  item: ReturnType<typeof getMergedScheduleForDate>[number]
  sourceDateISO: string
  listType: 'user' | 'weekly'
  relativeMinute: number
}

interface Interval {
  start: number
  end: number
}

interface ResizeState {
  instanceId: string
  sourceDateISO: string
  listType: 'user' | 'weekly'
  edge: 'start' | 'end'
  initialStartRelativeMinute: number
  initialEndRelativeMinute: number
  minStartRelativeMinute: number
  maxStartRelativeMinute: number
  minEndRelativeMinute: number
  maxEndRelativeMinute: number
}

interface ResizePreview {
  startRelativeMinute: number
  endRelativeMinute: number
}

interface DragGhostState {
  title: string
  durationMinutes: number
}

function toMinutes(hour: number, minute: number) {
  return hour * 60 + minute
}

function fromMinutes(total: number) {
  const safe = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return {
    hour: Math.floor(safe / 60),
    minute: safe % 60,
  }
}

function snapMinutes(minutes: number) {
  return Math.round(minutes)
}

function addMinutesToClock(hour: number, minute: number, minutesToAdd: number) {
  const total = toMinutes(hour, minute) + minutesToAdd
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return {
    hour: Math.floor(wrapped / 60),
    minute: wrapped % 60,
  }
}

function durationLabelWithSpacedUnits(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m === 0) return `${h} h`
  if (h > 0) return `${h} h ${m} m`
  return `${m} m`
}

function colorChannelsFromArgb(argb: number) {
  const value = argb >>> 0
  return {
    a: (value >>> 24) & 0xff,
    r: (value >>> 16) & 0xff,
    g: (value >>> 8) & 0xff,
    b: value & 0xff,
  }
}

function getTaskAccentColor(customColorArgb: number | null) {
  if (customColorArgb === null) return 'var(--primary-container)'
  const { r, g, b } = colorChannelsFromArgb(customColorArgb)
  return `rgb(${r}, ${g}, ${b})`
}

function getTaskBorderColor(customColorArgb: number | null) {
  if (customColorArgb === null) return 'rgba(88, 86, 214, 0.65)'
  const { a, r, g, b } = colorChannelsFromArgb(customColorArgb)
  const alpha = Math.max(0.35, Math.min(1, (a / 255) * 0.75))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function trayCardStyle(customColorArgb: number | null): CSSProperties {
  return {
    '--tray-accent': getTaskAccentColor(customColorArgb),
    '--tray-border': getTaskBorderColor(customColorArgb),
  } as CSSProperties
}

function mergeIntervals(intervals: Interval[]) {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

function resolveNonOverlappingStartMinute(
  desiredStartMinute: number,
  durationMinutes: number,
  occupiedIntervals: Interval[],
) {
  const safeDuration = Math.max(1, durationMinutes)
  const clampedDesired = Math.max(0, Math.min(24 * 60 - safeDuration, desiredStartMinute))
  const merged = mergeIntervals(occupiedIntervals)

  const overlapsAt = (startMinute: number) => {
    const endMinute = startMinute + safeDuration
    return merged.some((block) => startMinute < block.end && endMinute > block.start)
  }

  const findForwardFitFrom = (startMinute: number) => {
    let candidate = Math.max(0, Math.min(24 * 60 - safeDuration, startMinute))
    for (const block of merged) {
      if (candidate + safeDuration <= block.start) {
        break
      }
      if (candidate >= block.end) {
        continue
      }
      candidate = block.end
    }
    if (candidate + safeDuration <= 24 * 60) {
      return candidate
    }
    return null
  }

  // On release overlap, choose direction by intent:
  // - Drop inside/after a block => prefer placing below it.
  // - Approach from above => prefer placing above it.
  const conflictingBlock = merged.find(
    (block) => clampedDesired < block.end && clampedDesired + safeDuration > block.start,
  )

  if (conflictingBlock) {
    const aboveCandidate = conflictingBlock.start - safeDuration
    const belowCandidate = findForwardFitFrom(conflictingBlock.end)
    const canPlaceAbove = aboveCandidate >= 0 && !overlapsAt(aboveCandidate)

    if (clampedDesired >= conflictingBlock.start) {
      if (belowCandidate !== null) return belowCandidate
      if (canPlaceAbove) return aboveCandidate
    } else {
      if (canPlaceAbove) return aboveCandidate
      if (belowCandidate !== null) return belowCandidate
    }
  }

  let candidate = clampedDesired
  for (const block of merged) {
    if (candidate + safeDuration <= block.start) {
      break
    }
    if (candidate >= block.end) {
      continue
    }
    candidate = block.end
  }

  if (candidate + safeDuration <= 24 * 60) {
    return candidate
  }

  // If forward fitting overflows, pick the latest fitting gap in the day.
  let prevEnd = 0
  let best: number | null = null
  for (const block of merged) {
    if (block.start - prevEnd >= safeDuration) {
      best = block.start - safeDuration
    }
    prevEnd = Math.max(prevEnd, block.end)
  }
  if (24 * 60 - prevEnd >= safeDuration) {
    best = 24 * 60 - safeDuration
  }

  return best
}

function resolveLineSnapMinute(desiredStartMinute: number, occupiedIntervals: Interval[]) {
  const clampedDesired = Math.max(0, Math.min(24 * 60 - 1, desiredStartMinute))
  const merged = mergeIntervals(occupiedIntervals)

  let candidate = clampedDesired
  for (const block of merged) {
    if (candidate < block.start) {
      break
    }
    if (candidate >= block.end) {
      continue
    }
    candidate = block.end
  }

  return Math.max(0, Math.min(24 * 60 - 1, candidate))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

let transparentDragImage: HTMLImageElement | null = null

function setInvisibleDragPreview(event: React.DragEvent<HTMLElement>) {
  if (!transparentDragImage) {
    transparentDragImage = new Image()
    transparentDragImage.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  }
  event.dataTransfer.setDragImage(transparentDragImage, 0, 0)
}

function getPrayerMinuteForDate(
  prayerTimesByDate: Record<string, Array<{ name: string; hour: number; minute: number }>>,
  dateISO: string,
  prayerName: string,
) {
  const prayer = prayerTimesByDate[dateISO]?.find((item) => item.name === prayerName)
  if (!prayer) return null
  return toMinutes(prayer.hour, prayer.minute)
}

export function TimelinePage() {
  const state = useRhythmState()
  const actions = useRhythmActions()
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()))
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null)
  const [hoverMinute, setHoverMinute] = useState<number | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const dragDropCommittedRef = useRef(false)
  const suppressControlClickUntilRef = useRef(0)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [resizePreviewByInstanceId, setResizePreviewByInstanceId] = useState<
    Record<string, ResizePreview>
  >({})
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null)
  const [dragGhostResolvedMinute, setDragGhostResolvedMinute] = useState<number | null>(null)
  const nextDate = useMemo(() => addDays(selectedDate, 1), [selectedDate])

  const maghribStartMinute =
    getPrayerMinuteForDate(state.prayerTimesByDate, selectedDate, 'MAGHRIB') ?? toMinutes(18, 0)
  const maghribStartHour = Math.floor(maghribStartMinute / 60)

  const schedule = useMemo<WindowScheduledItem[]>(() => {
    const resolveListTypeForDate = (dateISO: string, instanceId: string): 'user' | 'weekly' => {
      const weekly = state.weeklyTasksByDate[dateISO] ?? []
      if (weekly.some((item) => item.instanceId === instanceId)) {
        return 'weekly'
      }
      return 'user'
    }

    const selectedItems = getMergedScheduleForDate(state, selectedDate)
      .filter((item) => toMinutes(item.startHour, item.startMinute) >= maghribStartMinute)
      .map((item) => ({
        item,
        sourceDateISO: selectedDate,
        listType: resolveListTypeForDate(selectedDate, item.instanceId),
        relativeMinute: toMinutes(item.startHour, item.startMinute) - maghribStartMinute,
      }))

    const nextItems = getMergedScheduleForDate(state, nextDate)
      .filter((item) => toMinutes(item.startHour, item.startMinute) < maghribStartMinute)
      .map((item) => ({
        item,
        sourceDateISO: nextDate,
        listType: resolveListTypeForDate(nextDate, item.instanceId),
        relativeMinute: 24 * 60 - maghribStartMinute + toMinutes(item.startHour, item.startMinute),
      }))

    return [...selectedItems, ...nextItems].sort((a, b) => a.relativeMinute - b.relativeMinute)
  }, [state, selectedDate, nextDate, maghribStartMinute])

  const userScheduled = useMemo(
    () => schedule.filter((entry) => !isAutoTaskId(entry.item.task.id)),
    [schedule],
  )

  useEffect(() => {
    let cancelled = false

    const selectedPrayerMissing = !state.prayerTimesByDate[selectedDate]
    const nextPrayerMissing = !state.prayerTimesByDate[nextDate]
    const selectedHijriDateMissing = typeof state.islamicDateByDate?.[selectedDate] === 'undefined'
    const selectedOccasionMissing = typeof state.islamicOccasionByDate[selectedDate] === 'undefined'

    const shouldFetchSelected =
      selectedPrayerMissing || selectedHijriDateMissing || selectedOccasionMissing
    const shouldFetchNext = nextPrayerMissing

    if (!shouldFetchSelected && !shouldFetchNext) return

    const prayerRequestConfig = {
      method: state.prayerSettings.calculationMethod,
      useDeviceLocation: state.prayerSettings.locationMode === 'DEVICE',
      manualLatitude: state.prayerSettings.manualLatitude,
      manualLongitude: state.prayerSettings.manualLongitude,
    }

    if (shouldFetchSelected) {
      void fetchPrayerDataForDate(selectedDate, prayerRequestConfig)
        .then(({ prayerTimes, hijriDateLabel, occasion: fetchedOccasion }) => {
          if (cancelled) return
          if (prayerTimes.length > 0) {
            actions.setPrayerTimesForDate(selectedDate, prayerTimes)
          }
          actions.setIslamicDateForDate(selectedDate, hijriDateLabel)
          actions.setIslamicOccasionForDate(selectedDate, fetchedOccasion)
        })
        .catch(() => {
          if (cancelled) return
          actions.setIslamicDateForDate(selectedDate, null)
          actions.setIslamicOccasionForDate(selectedDate, null)
        })
    }

    if (shouldFetchNext) {
      void fetchPrayerDataForDate(nextDate, prayerRequestConfig)
        .then(({ prayerTimes, hijriDateLabel }) => {
          if (cancelled) return
          if (prayerTimes.length > 0) {
            actions.setPrayerTimesForDate(nextDate, prayerTimes)
          }
          actions.setIslamicDateForDate(nextDate, hijriDateLabel)
        })
        .catch(() => {
          // Keep silent: next-day prayer data is best-effort for Maghrib-window rendering.
        })
    }

    return () => {
      cancelled = true
    }
  }, [
    actions,
    state.islamicDateByDate,
    selectedDate,
    nextDate,
    state.islamicOccasionByDate,
    state.prayerSettings.calculationMethod,
    state.prayerSettings.locationMode,
    state.prayerSettings.manualLatitude,
    state.prayerSettings.manualLongitude,
    state.prayerTimesByDate,
  ])

  function onTaskTrayDragStart(taskId: string, event: React.DragEvent<HTMLElement>) {
    if (resizeState) {
      event.preventDefault()
      return
    }
    const payload: DragPayload = { type: 'library', taskId }
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'copyMove'
    setInvisibleDragPreview(event)
    const task = state.libraryTasks.find((item) => item.id === taskId)
    if (task) {
      setDragGhost({
        title: task.title,
        durationMinutes: task.durationMinutes,
      })
    }
  }

  function onWeeklyBulletDragStart(
    taskId: string,
    bulletTitle: string,
    durationMinutes: number,
    event: React.DragEvent<HTMLElement>,
  ) {
    if (resizeState) {
      event.preventDefault()
      return
    }
    const payload: DragPayload = {
      type: 'weeklyBullet',
      taskId,
      bulletTitle,
      durationMinutes,
    }
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'copyMove'
    setInvisibleDragPreview(event)
    setDragGhost({
      title: bulletTitle,
      durationMinutes,
    })
  }

  function onScheduledDragStart(instanceId: string, event: React.DragEvent<HTMLElement>) {
    if (resizeState) {
      event.preventDefault()
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, label')) {
      event.preventDefault()
      return
    }

    const payload: DragPayload = { type: 'scheduled', instanceId }
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
    setInvisibleDragPreview(event)
    const scheduled = userScheduled.find((entry) => entry.item.instanceId === instanceId)
    if (scheduled) {
      setDragGhost({
        title: scheduled.item.task.title,
        durationMinutes: scheduled.item.task.durationMinutes,
      })
    }
    dragDropCommittedRef.current = false
    setDraggingInstanceId(instanceId)
  }

  function minuteFromDrop(event: React.DragEvent<HTMLElement>) {
    const timelineEl = timelineRef.current
    if (!timelineEl) return 0

    const rect = timelineEl.getBoundingClientRect()
    const yWithin = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    const rawMinute = (yWithin / HOUR_HEIGHT) * 60
    return Math.max(0, Math.min(24 * 60 - 1, snapMinutes(rawMinute)))
  }

  function isPointerInsideTimeline(event: React.DragEvent<HTMLElement>) {
    const timelineEl = timelineRef.current
    if (!timelineEl) return false
    const rect = timelineEl.getBoundingClientRect()
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    )
  }

  function onTimelineDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    const timelineEl = timelineRef.current
    if (!timelineEl) return

    const rawMinute = minuteFromDrop(event)
    setHoverMinute((prev) => (prev === rawMinute ? prev : rawMinute))

    if (!dragGhost) {
      setDragGhostResolvedMinute((prev) => (prev === null ? prev : null))
      return
    }

    const movingInstanceId = draggingInstanceId
    const occupiedIntervals: Interval[] = schedule
      .filter((entry) => entry.item.instanceId !== movingInstanceId)
      .map((entry) => {
        const start = Math.max(0, Math.min(24 * 60, entry.relativeMinute))
        const end = Math.max(start, Math.min(24 * 60, start + entry.item.task.durationMinutes))
        return { start, end }
      })

    const resolved = resolveLineSnapMinute(rawMinute, occupiedIntervals)

    setDragGhostResolvedMinute((prev) => (prev === resolved ? prev : resolved))
  }

  function onTimelineDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()

    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return

    const payload = JSON.parse(raw) as DragPayload
    const dropMinute = minuteFromDrop(event)

    const movingInstanceId = payload.type === 'scheduled' ? payload.instanceId ?? null : null
    const occupiedIntervals: Interval[] = schedule
      .filter((entry) => entry.item.instanceId !== movingInstanceId)
      .map((entry) => {
        const start = Math.max(0, Math.min(24 * 60, entry.relativeMinute))
        const end = Math.max(start, Math.min(24 * 60, start + entry.item.task.durationMinutes))
        return { start, end }
      })

    const desiredDuration =
      payload.type === 'library'
        ? state.libraryTasks.find((item) => item.id === payload.taskId)?.durationMinutes ?? 30
        : payload.type === 'weeklyBullet'
          ? payload.durationMinutes ??
            state.weeklyTasks.find((item) => item.id === payload.taskId)?.durationMinutes ??
            30
          : userScheduled.find((entry) => entry.item.instanceId === payload.instanceId)?.item.task
              .durationMinutes ?? 30

    const resolvedRelativeMinute = resolveNonOverlappingStartMinute(
      dropMinute,
      desiredDuration,
      occupiedIntervals,
    )

    if (resolvedRelativeMinute === null) {
      setDraggingInstanceId(null)
      setHoverMinute(null)
      setDragGhost(null)
      setDragGhostResolvedMinute(null)
      return
    }

    const absoluteMinute = maghribStartMinute + resolvedRelativeMinute
    const dayOffset = absoluteMinute >= 24 * 60 ? 1 : 0
    const targetDateISO = dayOffset === 1 ? nextDate : selectedDate
    const { hour, minute } = fromMinutes(absoluteMinute)

    if (payload.type === 'library' && payload.taskId) {
      const task = state.libraryTasks.find((item) => item.id === payload.taskId)
      if (!task) return
      actions.scheduleTaskOnDate({
        dateISO: targetDateISO,
        task,
        startHour: hour,
        startMinute: minute,
        listType: 'user',
      })
    }

    if (payload.type === 'weeklyBullet' && payload.taskId && payload.bulletTitle) {
      const parentTask = state.weeklyTasks.find((item) => item.id === payload.taskId)
      const task = {
        id: generateId('weekly-bullet'),
        title: payload.bulletTitle,
        durationMinutes: payload.durationMinutes ?? parentTask?.durationMinutes ?? 30,
        icon: parentTask?.icon ?? 'task',
        category: parentTask?.category ?? 'DEFAULT',
        customColorArgb: parentTask?.customColorArgb ?? null,
        recurringDays: parentTask?.recurringDays ?? [],
      }
      actions.scheduleTaskOnDate({
        dateISO: targetDateISO,
        task,
        startHour: hour,
        startMinute: minute,
        listType: 'weekly',
      })
    }

    if (payload.type === 'scheduled' && payload.instanceId) {
      const scheduled = userScheduled.find((entry) => entry.item.instanceId === payload.instanceId)
      if (!scheduled || isAutoTaskId(scheduled.item.task.id)) return

      if (scheduled.sourceDateISO === targetDateISO) {
        actions.rescheduleScheduledTask({
          dateISO: scheduled.sourceDateISO,
          instanceId: payload.instanceId,
          listType: scheduled.listType,
          startHour: hour,
          startMinute: minute,
        })
      } else {
        actions.moveScheduledTaskToDate({
          fromDateISO: scheduled.sourceDateISO,
          toDateISO: targetDateISO,
          instanceId: payload.instanceId,
          listType: scheduled.listType,
          startHour: hour,
          startMinute: minute,
        })
      }

      dragDropCommittedRef.current = true
    }

    setDraggingInstanceId(null)
    setHoverMinute(null)
    setDragGhost(null)
    setDragGhostResolvedMinute(null)
  }

  function onTimelineDragLeave(event: React.DragEvent<HTMLElement>) {
    // Native dragleave can fire when moving between child nodes; only clear when truly outside.
    if (isPointerInsideTimeline(event)) return
    setHoverMinute(null)
    setDragGhostResolvedMinute(null)
  }

  function onResizeHandlePointerDown(
    event: React.PointerEvent<HTMLElement>,
    entry: WindowScheduledItem,
    edge: 'start' | 'end',
  ) {
    event.preventDefault()
    event.stopPropagation()

    const minStartRelativeMinute = 0
    const maxStartRelativeMinute = 24 * 60
    const minEndRelativeMinute = 0
    const maxEndRelativeMinute = 24 * 60

    setResizeState({
      instanceId: entry.item.instanceId,
      sourceDateISO: entry.sourceDateISO,
      listType: entry.listType,
      edge,
      initialStartRelativeMinute: entry.relativeMinute,
      initialEndRelativeMinute: entry.relativeMinute + entry.item.task.durationMinutes,
      minStartRelativeMinute,
      maxStartRelativeMinute,
      minEndRelativeMinute,
      maxEndRelativeMinute,
    })
  }

  useEffect(() => {
    if (!resizeState) return
    const activeResize = resizeState
    const occupiedIntervals = mergeIntervals(
      schedule
        .filter((entry) => entry.item.instanceId !== activeResize.instanceId)
        .map((entry) => ({
          start: Math.max(0, Math.min(24 * 60, entry.relativeMinute)),
          end: Math.max(
            0,
            Math.min(24 * 60, entry.relativeMinute + entry.item.task.durationMinutes),
          ),
        }))
        .filter((interval) => interval.end > interval.start),
    )

    function relativeMinuteFromClientY(clientY: number) {
      const timelineEl = timelineRef.current
      if (!timelineEl) return activeResize.initialStartRelativeMinute
      const rect = timelineEl.getBoundingClientRect()
      const yWithin = clamp(clientY - rect.top, 0, rect.height)
      return Math.round((yWithin / HOUR_HEIGHT) * 60)
    }

    function onPointerMove(event: PointerEvent) {
      const minDuration = 5
      const pointerMinute = relativeMinuteFromClientY(event.clientY)

      if (activeResize.edge === 'start') {
        const fixedEnd = activeResize.initialEndRelativeMinute
        const overlapLowerBound = occupiedIntervals.reduce((maxEnd, interval) => {
          if (interval.end <= fixedEnd) {
            return Math.max(maxEnd, interval.end)
          }
          return maxEnd
        }, activeResize.minStartRelativeMinute)

        const maxStartBound = Math.min(
          activeResize.maxStartRelativeMinute,
          fixedEnd - minDuration,
        )

        const nextStart = clamp(
          pointerMinute,
          overlapLowerBound,
          Math.max(overlapLowerBound, maxStartBound),
        )

        setResizePreviewByInstanceId((prev) => ({
          ...prev,
          [activeResize.instanceId]: {
            startRelativeMinute: nextStart,
            endRelativeMinute: fixedEnd,
          },
        }))
      } else {
        const fixedStart = activeResize.initialStartRelativeMinute
        const overlapUpperBound = occupiedIntervals.reduce((minStart, interval) => {
          if (interval.start >= fixedStart) {
            return Math.min(minStart, interval.start)
          }
          return minStart
        }, activeResize.maxEndRelativeMinute)

        const minEndBound = Math.max(
          activeResize.minEndRelativeMinute + minDuration,
          fixedStart + minDuration,
        )

        const nextEnd = clamp(
          pointerMinute,
          minEndBound,
          Math.max(minEndBound, overlapUpperBound),
        )

        setResizePreviewByInstanceId((prev) => ({
          ...prev,
          [activeResize.instanceId]: {
            startRelativeMinute: fixedStart,
            endRelativeMinute: nextEnd,
          },
        }))
      }
    }

    function onPointerUp() {
      const preview = resizePreviewByInstanceId[activeResize.instanceId]
      const finalStart = preview?.startRelativeMinute ?? activeResize.initialStartRelativeMinute
      const finalEnd = preview?.endRelativeMinute ?? activeResize.initialEndRelativeMinute

      const finalDuration = Math.max(1, finalEnd - finalStart)
      const absoluteStartMinute = maghribStartMinute + finalStart
      const targetDateISO = absoluteStartMinute >= 24 * 60 ? nextDate : selectedDate
      const { hour, minute } = fromMinutes(absoluteStartMinute)

      if (targetDateISO === activeResize.sourceDateISO) {
        actions.updateScheduledTaskTiming({
          dateISO: activeResize.sourceDateISO,
          instanceId: activeResize.instanceId,
          listType: activeResize.listType,
          startHour: hour,
          startMinute: minute,
          durationMinutes: finalDuration,
        })
      } else {
        actions.moveScheduledTaskToDate({
          fromDateISO: activeResize.sourceDateISO,
          toDateISO: targetDateISO,
          instanceId: activeResize.instanceId,
          listType: activeResize.listType,
          startHour: hour,
          startMinute: minute,
          durationMinutes: finalDuration,
        })
      }

      setResizeState(null)
      setResizePreviewByInstanceId((prev) => {
        const next = { ...prev }
        delete next[activeResize.instanceId]
        return next
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [
    actions,
    maghribStartMinute,
    nextDate,
    schedule,
    resizePreviewByInstanceId,
    resizeState,
    selectedDate,
  ])

  const hourRows = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), [])

  const now = new Date()
  const nowDateISO = formatDateISO(now)
  const nowMinute = toMinutes(now.getHours(), now.getMinutes())

  const nowRelativeMinute = useMemo(() => {
    if (nowDateISO !== selectedDate) {
      return null
    }

    if (nowMinute >= maghribStartMinute) {
      return nowMinute - maghribStartMinute
    }

    return 24 * 60 - maghribStartMinute + nowMinute
  }, [nowDateISO, nowMinute, selectedDate, maghribStartMinute])

  const dragPreviewMinute = dragGhost ? dragGhostResolvedMinute : hoverMinute

  const dragPreviewLineY = useMemo(() => {
    if (dragPreviewMinute === null) return null
    return topFromRelativeMinute(dragPreviewMinute)
  }, [dragPreviewMinute])

  const dragLineTimeLabel = useMemo(() => {
    if (dragPreviewMinute === null) return null
    const lineClock = fromMinutes(maghribStartMinute + dragPreviewMinute)
    return formatTime(lineClock.hour, lineClock.minute)
  }, [dragPreviewMinute, maghribStartMinute])

  const nowTimeLabel = useMemo(() => {
    if (nowRelativeMinute === null) return null
    const lineClock = fromMinutes(maghribStartMinute + nowRelativeMinute)
    return formatTime(lineClock.hour, lineClock.minute)
  }, [nowRelativeMinute, maghribStartMinute])

  const topHeaderDateLabel = useMemo(
    () =>
      new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [selectedDate],
  )

  const topHeaderHijriDateLabel = useMemo(() => {
    const apiLabel = state.islamicDateByDate?.[selectedDate]
    if (typeof apiLabel === 'string' && apiLabel.length > 0) {
      return apiLabel
    }
    return null
  }, [selectedDate, state.islamicDateByDate])

  const todayISO = formatDateISO(new Date())

  const todayWeeklyTaskTitles = useMemo(() => {
    const weeklyToday = state.weeklyTasksByDate[todayISO] ?? []
    return Array.from(
      new Set(
        weeklyToday
          .map((entry) => entry.task.title.trim())
          .filter((title) => title.length > 0),
      ),
    )
  }, [state.weeklyTasksByDate, todayISO])

  const relativeDayLabel = useMemo(() => {
    if (selectedDate === todayISO) return 'Today'
    if (selectedDate === addDays(todayISO, 1)) return 'Tomorrow'
    if (selectedDate === addDays(todayISO, -1)) return 'Yesterday'
    return null
  }, [selectedDate, todayISO])

  const weeklyBulletGroups = useMemo(() => {
    const weeklyToday = state.weeklyTasksByDate[todayISO] ?? []
    const groups = new Map<
      string,
      {
        taskId: string
        taskTitle: string
        durationMinutes: number
        customColorArgb: number | null
        bullets: Array<{
          order: number
          title: string
        }>
      }
    >()

    for (const item of weeklyToday) {
      const key = item.task.id
      const existing = groups.get(key)
      const cleanedBullets = item.bulletPoints
        .map((bullet, idx) => ({
          order: idx + 1,
          title: bullet.trim(),
        }))
        .filter((bullet) => bullet.title.length > 0)

      if (!existing) {
        groups.set(key, {
          taskId: item.task.id,
          taskTitle: item.task.title,
          durationMinutes: item.task.durationMinutes,
          customColorArgb: item.task.customColorArgb,
          bullets: cleanedBullets,
        })
        continue
      }

      existing.bullets.push(...cleanedBullets)
    }

    return Array.from(groups.values())
  }, [state.weeklyTasksByDate, todayISO])

  const timelineHeight = HOUR_HEIGHT * 24

  function topFromRelativeMinute(relativeMinute: number) {
    return (relativeMinute / 60) * HOUR_HEIGHT
  }

  function heightFromDuration(durationMinutes: number) {
    return (durationMinutes / 60) * HOUR_HEIGHT
  }

  return (
    <section className="timeline-desktop-page">
      <article className="timeline-center panel">
        <div className="timeline-topbar">
          <div className="timeline-top-copy">
            <p className="timeline-top-date">{topHeaderDateLabel}</p>
            {topHeaderHijriDateLabel ? <p className="timeline-top-hijri-date">{topHeaderHijriDateLabel}</p> : null}
            <h1 className="timeline-top-title">
              {todayWeeklyTaskTitles.length > 0 ? (
                todayWeeklyTaskTitles.map((title) => (
                  <span key={title} className="timeline-top-title-line">
                    {title}
                  </span>
                ))
              ) : (
                <span className="timeline-top-title-line">No Weekly Tasks Today</span>
              )}
            </h1>
            {relativeDayLabel ? <p className="timeline-top-relative">{relativeDayLabel}</p> : null}
          </div>

          <div className="timeline-top-nav" aria-label="Timeline date navigation">
            <button
              className="timeline-nav-icon"
              aria-label="Jump to today"
              title="Today"
              onClick={() => setSelectedDate(formatDateISO(new Date()))}
            >
              ↻
            </button>
            <button className="timeline-nav-icon" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
              ‹
            </button>
            <button className="timeline-nav-icon" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
              ›
            </button>
          </div>
        </div>

        <div className="timeline-scroll-viewport">
          <div
            ref={timelineRef}
            className="timeline-grid"
            onDragOver={onTimelineDragOver}
            onDrop={onTimelineDrop}
            onDragLeave={onTimelineDragLeave}
            style={{ height: `${timelineHeight}px` }}
          >
            {dragPreviewLineY !== null && dragLineTimeLabel ? (
              <div className="timeline-drop-time-badge" style={{ top: `${dragPreviewLineY}px` }}>
                {dragLineTimeLabel}
              </div>
            ) : null}

            {nowRelativeMinute !== null && nowTimeLabel ? (
              <div className="timeline-now-time-badge" style={{ top: `${topFromRelativeMinute(nowRelativeMinute)}px` }}>
                {nowTimeLabel}
              </div>
            ) : null}

            <div className="timeline-hours" aria-hidden="true">
              {hourRows.map((hour) => (
                <div key={hour} className="timeline-hour-row">
                  <span>
                    {(maghribStartHour + hour) % 12 === 0 ? 12 : (maghribStartHour + hour) % 12}{' '}
                    {(maghribStartHour + hour) % 24 < 12 ? 'AM' : 'PM'}
                  </span>
                </div>
              ))}
            </div>

            <div className="timeline-surface">
            {hourRows.map((hour) => (
              <div key={hour} className="timeline-line" />
            ))}

            {nowRelativeMinute !== null ? (
              <div
                className="timeline-now"
                style={{ top: `${(nowRelativeMinute / 60) * HOUR_HEIGHT}px` }}
                aria-hidden="true"
              >
                <div className="timeline-now-line" />
              </div>
            ) : null}

            {dragPreviewLineY !== null ? (
              <>
                <div className="timeline-drop-preview" style={{ top: `${dragPreviewLineY}px` }} />
              </>
            ) : null}

            {dragGhost && dragGhostResolvedMinute !== null ? (
              (() => {
                const ghostStartClock = fromMinutes(maghribStartMinute + dragGhostResolvedMinute)
                const ghostEndClock = addMinutesToClock(
                  ghostStartClock.hour,
                  ghostStartClock.minute,
                  dragGhost.durationMinutes,
                )

                return (
                  <article
                    className="timeline-block timeline-ghost-block"
                    style={{
                      top: `${topFromRelativeMinute(dragGhostResolvedMinute)}px`,
                      height: `${heightFromDuration(dragGhost.durationMinutes)}px`,
                    }}
                    aria-hidden="true"
                  >
                    <button className="timeline-icon-button" disabled>
                      ×
                    </button>

                    <div className="timeline-block-main-row">
                      <div className="timeline-block-title-group">
                        <input className="timeline-circle-checkbox" type="checkbox" readOnly />
                        <h4>
                          {dragGhost.title} ({durationLabelWithSpacedUnits(dragGhost.durationMinutes)})
                        </h4>
                      </div>
                      <span className="timeline-block-time-range">
                        {formatTime(ghostStartClock.hour, ghostStartClock.minute)} -{' '}
                        {formatTime(ghostEndClock.hour, ghostEndClock.minute)}
                      </span>
                    </div>
                  </article>
                )
              })()
            ) : null}

              {schedule.map((entry) => {
              const auto = isAutoTaskId(entry.item.task.id)
              const sleepAuto = entry.item.task.id.startsWith('auto-sleep-')
              const preview = resizePreviewByInstanceId[entry.item.instanceId]
              const startRelativeMinute = preview?.startRelativeMinute ?? entry.relativeMinute
              const endRelativeMinute =
                preview?.endRelativeMinute ?? entry.relativeMinute + entry.item.task.durationMinutes
              const top = topFromRelativeMinute(startRelativeMinute)
              const height = heightFromDuration(endRelativeMinute - startRelativeMinute)
              const startClock = fromMinutes(maghribStartMinute + startRelativeMinute)
              const durationForDisplay = Math.max(1, endRelativeMinute - startRelativeMinute)
              const endTime = addMinutesToClock(
                startClock.hour,
                startClock.minute,
                durationForDisplay,
              )

              return (
                <article
                  key={`${entry.sourceDateISO}-${entry.item.instanceId}`}
                  className={`timeline-block ${auto ? 'timeline-block-auto' : ''} ${sleepAuto ? 'timeline-block-sleep' : ''} ${draggingInstanceId === entry.item.instanceId ? 'timeline-block-dragging' : ''}`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  draggable={!auto}
                  onDragStart={(event) => onScheduledDragStart(entry.item.instanceId, event)}
                  onDragEnd={() => {
                    if (dragDropCommittedRef.current) {
                      suppressControlClickUntilRef.current = Date.now() + 180
                    }
                    setDraggingInstanceId(null)
                    setHoverMinute(null)
                    setDragGhost(null)
                    setDragGhostResolvedMinute(null)
                  }}
                >
                  {!auto ? (
                    <button
                      className="timeline-icon-button"
                      draggable={false}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        if (Date.now() < suppressControlClickUntilRef.current) return
                        actions.deleteScheduledTask({
                          dateISO: entry.sourceDateISO,
                          instanceId: entry.item.instanceId,
                          listType: entry.listType,
                        })
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  ) : null}

                  <div className="timeline-block-main-row">
                    <div className="timeline-block-title-group">
                      {!auto ? (
                        <input
                          className="timeline-circle-checkbox"
                          type="checkbox"
                          checked={entry.item.isCompleted}
                          draggable={false}
                          onPointerDown={(event) => event.stopPropagation()}
                          aria-label="Mark task as done"
                          onChange={(event) => {
                            if (Date.now() < suppressControlClickUntilRef.current) return
                            actions.toggleScheduledCompletion({
                              dateISO: entry.sourceDateISO,
                              instanceId: entry.item.instanceId,
                              listType: entry.listType,
                              completed: event.target.checked,
                            })
                          }}
                        />
                      ) : null}
                      <h4>
                        {entry.item.task.title} ({durationLabelWithSpacedUnits(durationForDisplay)})
                      </h4>
                    </div>
                    <span className="timeline-block-time-range">
                      {formatTime(startClock.hour, startClock.minute)} -{' '}
                      {formatTime(endTime.hour, endTime.minute)}
                    </span>
                  </div>

                  {!auto ? (
                    <>
                      <div
                        className="timeline-resize-handle timeline-resize-handle-top"
                        onPointerDown={(event) => onResizeHandlePointerDown(event, entry, 'start')}
                        title="Drag to change start time"
                      />
                      <div
                        className="timeline-resize-handle timeline-resize-handle-bottom"
                        onPointerDown={(event) => onResizeHandlePointerDown(event, entry, 'end')}
                        title="Drag to change end time"
                      />
                    </>
                  ) : null}
                </article>
              )
              })}
            </div>
          </div>
        </div>
      </article>

      <aside className="timeline-right-column">
        <article className="timeline-right panel">
          <div className="timeline-right-header">
            <h3>Task Tray</h3>
          </div>

          <div className="timeline-tray-list">
            {state.libraryTasks.length === 0 ? (
              <p className="empty-state">No library tasks. Add from Tasks page.</p>
            ) : (
              state.libraryTasks.map((task) => (
                <article
                  key={task.id}
                  className="timeline-tray-item"
                  style={trayCardStyle(task.customColorArgb)}
                  draggable
                  onDragStart={(event) => onTaskTrayDragStart(task.id, event)}
                >
                  <div className="timeline-tray-item-main">
                    <h4>
                      {task.title} ({durationLabel(task.durationMinutes)})
                    </h4>
                  </div>
                  <span className="timeline-drag-handle">⋮⋮</span>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="timeline-right panel">
          <div className="timeline-right-header">
            <h3>Weekly Tasks</h3>
          </div>

          <div className="timeline-tray-list">
            {weeklyBulletGroups.length === 0 ? (
              <p className="empty-state">No weekly bullets for today. Add from Week page.</p>
            ) : (
              weeklyBulletGroups.map((group) => (
                <section key={group.taskId} className="timeline-tray-group">
                  <h4 className="timeline-tray-group-title" style={trayCardStyle(group.customColorArgb)}>
                    {group.taskTitle}
                  </h4>

                  {group.bullets.length === 0 ? (
                    <p className="timeline-tray-group-empty">No bullet points</p>
                  ) : (
                    group.bullets.map((bullet) => (
                      <article
                        key={`${group.taskId}-${bullet.order}-${bullet.title}`}
                        className="timeline-tray-item"
                        style={trayCardStyle(group.customColorArgb)}
                        draggable
                        onDragStart={(event) =>
                          onWeeklyBulletDragStart(group.taskId, bullet.title, group.durationMinutes, event)
                        }
                      >
                        <div className="timeline-tray-item-main">
                          <h4>
                            <span className="timeline-tray-item-index">{bullet.order}.</span> {bullet.title} ({durationLabel(group.durationMinutes)})
                          </h4>
                        </div>
                        <span className="timeline-drag-handle">⋮⋮</span>
                      </article>
                    ))
                  )}
                </section>
              ))
            )}
          </div>
        </article>
      </aside>
    </section>
  )
}
