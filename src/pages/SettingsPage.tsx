import { useState } from 'react'
import { useRhythmActions, useRhythmState } from '../state/rhythmState'

export function SettingsPage() {
  const state = useRhythmState()
  const actions = useRhythmActions()

  const [method, setMethod] = useState(String(state.prayerSettings.calculationMethod))
  const [locationMode, setLocationMode] = useState(state.prayerSettings.locationMode)
  const [latitude, setLatitude] = useState(String(state.prayerSettings.manualLatitude))
  const [longitude, setLongitude] = useState(String(state.prayerSettings.manualLongitude))

  const [sleepDuration, setSleepDuration] = useState(String(state.defaultSleepSettings.durationMinutes))
  const [wakeBeforeFajr, setWakeBeforeFajr] = useState(
    String(state.defaultSleepSettings.wakeBeforeFajrMinutes),
  )
  const [sleepAfterIsha, setSleepAfterIsha] = useState(
    String(state.defaultSleepSettings.sleepAfterIshaMinutes),
  )

  const [prayerSleepNotifications, setPrayerSleepNotifications] = useState(
    state.reminderSettings.prayerAndSleepNotificationsEnabled,
  )
  const [taskNotifications, setTaskNotifications] = useState(
    state.reminderSettings.taskNotificationsEnabled,
  )

  function applyPrayerSettings() {
    const methodNumber = Number.parseInt(method, 10)
    const lat = Number.parseFloat(latitude)
    const lon = Number.parseFloat(longitude)

    if (Number.isNaN(methodNumber) || Number.isNaN(lat) || Number.isNaN(lon)) return

    actions.setPrayerSettings({
      calculationMethod: methodNumber,
      locationMode,
      manualLatitude: lat,
      manualLongitude: lon,
    })
  }

  function applySleepSettings() {
    const duration = Number.parseInt(sleepDuration, 10)
    const wakeOffset = Number.parseInt(wakeBeforeFajr, 10)
    const sleepOffset = Number.parseInt(sleepAfterIsha, 10)

    if (Number.isNaN(duration) || Number.isNaN(wakeOffset) || Number.isNaN(sleepOffset)) return

    actions.setDefaultSleepSettings({
      durationMinutes: Math.max(1, duration),
      wakeBeforeFajrMinutes: Math.max(0, wakeOffset),
      sleepAfterIshaMinutes: Math.max(0, sleepOffset),
    })
  }

  function applyReminderSettings() {
    actions.setReminderSettings({
      prayerAndSleepNotificationsEnabled: prayerSleepNotifications,
      taskNotificationsEnabled: taskNotifications,
    })
  }

  return (
    <section className="settings-page">
      <article className="panel settings-panel">
        <h2>Prayer Settings</h2>
        <div className="settings-grid">
          <label>
            Calculation Method
            <input value={method} onChange={(e) => setMethod(e.target.value)} />
          </label>

          <label>
            Location Mode
            <select
              value={locationMode}
              onChange={(e) => setLocationMode(e.target.value as 'DEVICE' | 'MANUAL')}
            >
              <option value="DEVICE">Device</option>
              <option value="MANUAL">Manual</option>
            </select>
          </label>

          <label>
            Latitude
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </label>

          <label>
            Longitude
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </label>
        </div>
        <button onClick={applyPrayerSettings}>Save Prayer Settings</button>
      </article>

      <article className="panel settings-panel">
        <h2>Sleep Settings</h2>
        <div className="settings-grid">
          <label>
            Duration (minutes)
            <input value={sleepDuration} onChange={(e) => setSleepDuration(e.target.value)} />
          </label>
          <label>
            Wake Before Fajr (minutes)
            <input value={wakeBeforeFajr} onChange={(e) => setWakeBeforeFajr(e.target.value)} />
          </label>
          <label>
            Sleep After Isha (minutes)
            <input value={sleepAfterIsha} onChange={(e) => setSleepAfterIsha(e.target.value)} />
          </label>
        </div>
        <button onClick={applySleepSettings}>Save Sleep Settings</button>
      </article>

      <article className="panel settings-panel">
        <h2>Reminder Settings</h2>
        <div className="settings-grid">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={prayerSleepNotifications}
              onChange={(e) => setPrayerSleepNotifications(e.target.checked)}
            />
            Prayer and Sleep Notifications
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={taskNotifications}
              onChange={(e) => setTaskNotifications(e.target.checked)}
            />
            Task Notifications
          </label>
        </div>
        <button onClick={applyReminderSettings}>Save Reminder Settings</button>
      </article>
    </section>
  )
}
