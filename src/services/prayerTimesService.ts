import type { PrayerName, PrayerTime } from '../models/rhythm'

interface FetchConfig {
  method: number
  useDeviceLocation: boolean
  manualLatitude: number
  manualLongitude: number
}

const DUBAI_LAT = 25.2048
const DUBAI_LON = 55.2708

function parseHourMinute(raw: string) {
  const hhmm = raw.trim().slice(0, 5)
  const [hh, mm] = hhmm.split(':')
  const hour = Number.parseInt(hh ?? '', 10)
  const minute = Number.parseInt(mm ?? '', 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

async function getCoordinates(config: FetchConfig) {
  if (!config.useDeviceLocation) {
    return {
      lat: config.manualLatitude,
      lon: config.manualLongitude,
    }
  }

  if (!navigator.geolocation) {
    return { lat: DUBAI_LAT, lon: DUBAI_LON }
  }

  return new Promise<{ lat: number; lon: number }>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () => resolve({ lat: DUBAI_LAT, lon: DUBAI_LON }),
      {
        timeout: 6000,
      },
    )
  })
}

function toDateSegments(dateISO: string) {
  const [year, month, day] = dateISO.split('-')
  return {
    day: Number.parseInt(day ?? '', 10),
    month: Number.parseInt(month ?? '', 10),
    year: Number.parseInt(year ?? '', 10),
  }
}

function pickWidelyObservedOccasion(holidays: string[], hijriDay?: number, hijriMonth?: number) {
  const normalized = holidays.map((item) => item.toLowerCase())

  if (normalized.some((item) => item.includes('eid al-fitr') || item.includes('eid ul-fitr'))) {
    return 'Eid al-Fitr'
  }
  if (
    normalized.some(
      (item) => item.includes('day of arafah') || item.includes('arafah') || item.includes('arafat'),
    )
  ) {
    return 'Day of Arafah'
  }
  if (normalized.some((item) => item.includes('eid al-adha') || item.includes('eid ul-adha'))) {
    return 'Eid al-Adha'
  }
  if (normalized.some((item) => item.includes('ashura') || item.includes('ashuraa'))) {
    return 'Ashura'
  }

  if (hijriMonth === 1 && hijriDay === 1) return 'New Hijri Year'
  if (hijriMonth === 1 && hijriDay === 10) return 'Ashura'
  if (hijriMonth === 12 && hijriDay === 9) return 'Day of Arafah'
  if (hijriMonth === 12 && hijriDay === 10) return 'Eid al-Adha'
  if (hijriMonth === 10 && hijriDay === 1) return 'Eid al-Fitr'

  return null
}

export async function fetchPrayerDataForDate(dateISO: string, config: FetchConfig): Promise<{
  prayerTimes: PrayerTime[]
  hijriDateLabel: string | null
  occasion: string | null
}> {
  const { lat, lon } = await getCoordinates(config)
  const { day, month, year } = toDateSegments(dateISO)

  const endpoint =
    `https://api.aladhan.com/v1/timings/${day}-${month}-${year}` +
    `?latitude=${lat}&longitude=${lon}&method=${config.method}`

  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error('Failed to fetch prayer times')
  }

  const body = await response.json()
  const timings = body?.data?.timings

  const mapping: Array<[PrayerName, string]> = [
    ['FAJR', timings?.Fajr ?? ''],
    ['DHUHR', timings?.Dhuhr ?? ''],
    ['ASR', timings?.Asr ?? ''],
    ['MAGHRIB', timings?.Maghrib ?? ''],
    ['ISHA', timings?.Isha ?? ''],
  ]

  const prayerTimes = mapping
    .map(([name, raw]) => {
      const parsed = parseHourMinute(raw)
      if (!parsed) return null
      return {
        name,
        hour: parsed.hour,
        minute: parsed.minute,
      } satisfies PrayerTime
    })
    .filter((item): item is PrayerTime => Boolean(item))

  const hijri = body?.data?.date?.hijri
  const hijriDay = Number.parseInt(String(hijri?.day ?? ''), 10)
  const hijriMonthEn = typeof hijri?.month?.en === 'string' ? hijri.month.en : null
  const hijriYear = Number.parseInt(String(hijri?.year ?? ''), 10)
  const hijriDateLabel =
    Number.isFinite(hijriDay) && hijriMonthEn && Number.isFinite(hijriYear)
      ? `${hijriDay} ${hijriMonthEn} ${hijriYear} AH`
      : null

  const holidaysRaw = Array.isArray(hijri?.holidays)
    ? hijri.holidays.filter((item: unknown) => typeof item === 'string')
    : []

  const occasion = pickWidelyObservedOccasion(
    holidaysRaw,
    hijriDay,
    Number.parseInt(String(hijri?.month?.number ?? ''), 10),
  )

  return {
    prayerTimes,
    hijriDateLabel,
    occasion,
  }
}
