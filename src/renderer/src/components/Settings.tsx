import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Settings as SettingsIcon, X } from 'lucide-react'
import { BREAK_DURATION_LIMITS, DEFAULT_SETTINGS } from '../../../shared/constants'
import type { AppSettings } from '../../../shared/types'

type ToggleRowProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title?: string
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  title
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className="settings-toggle-row" title={title}>
      <span>{label}</span>
      <button
        className="settings-switch"
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

type DurationChoicesProps = {
  name: string
  label: string
  values: number[]
  value: number
  onChange: (value: number) => void
}

function DurationChoices({
  name,
  label,
  values,
  value,
  onChange
}: DurationChoicesProps): React.JSX.Element {
  return (
    <fieldset className="settings-duration">
      <legend>{label}</legend>
      <div className="settings-segments">
        {values.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{option} min</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function Settings(): React.JSX.Element {
  const [draft, setDraft] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startingBreak, setStartingBreak] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void window.wigglebuddy.getSettings().then(
      (settings) => {
        if (!active) return
        setDraft(settings)
        setLoaded(true)
      },
      () => {
        if (active) setError('Settings could not be loaded. Close this panel and try again.')
      }
    )
    return () => {
      active = false
    }
  }, [])

  function change<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!loaded || saving) return
    setSaving(true)
    setError('')
    try {
      await window.wigglebuddy.saveSettings(draft)
      window.close()
    } catch {
      setError('Your settings could not be saved. Please try again.')
      setSaving(false)
    }
  }

  async function startBreakNow(): Promise<void> {
    if (!loaded || saving || startingBreak) return
    setStartingBreak(true)
    setError('')
    try {
      await window.wigglebuddy.startBreakNow(draft.breakDurationSeconds)
    } catch {
      setError('The break could not be started. Please try again.')
    } finally {
      setStartingBreak(false)
    }
  }

  const rangeStyle = {
    '--range-progress': `${((draft.reminderIntervalMinutes - 5) / 115) * 100}%`
  } as CSSProperties
  const breakRangeStyle = {
    '--range-progress': `${((draft.breakDurationSeconds - BREAK_DURATION_LIMITS.min) / (BREAK_DURATION_LIMITS.max - BREAK_DURATION_LIMITS.min)) * 100}%`
  } as CSSProperties

  return (
    <main
      className="settings-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape') window.close()
      }}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-labelledby="settings-title"
        aria-busy={!loaded || saving}
      >
        <header className="settings-header">
          <SettingsIcon size={20} strokeWidth={1.5} aria-hidden="true" />
          <span className="settings-header-divider" aria-hidden="true" />
          <h1 id="settings-title">Settings</h1>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            onClick={() => window.close()}
            autoFocus
          >
            <X size={28} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </header>

        <form className="settings-form" onSubmit={(event) => void save(event)}>
          <div className="settings-content">
            <fieldset className="settings-fields" disabled={!loaded || saving || startingBreak}>
              <h2 className="settings-section-title">Breaks</h2>
              <button
                type="button"
                className="settings-start-break"
                onClick={() => void startBreakNow()}
              >
                {startingBreak ? 'Starting…' : 'Start break now'}
              </button>
              <ToggleRow
                label="Show Pet"
                checked={draft.showPet}
                onChange={(value) => change('showPet', value)}
              />

              <div className="settings-block">
                <label className="settings-label" htmlFor="reminder-interval">
                  Reminder interval
                </label>
                <div className="settings-interval">
                  <input
                    id="reminder-interval"
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={draft.reminderIntervalMinutes}
                    aria-valuetext={`${draft.reminderIntervalMinutes} minutes`}
                    style={rangeStyle}
                    onChange={(event) =>
                      change('reminderIntervalMinutes', Number(event.target.value))
                    }
                  />
                  <output htmlFor="reminder-interval">
                    {draft.reminderIntervalMinutes}
                    <span>min</span>
                  </output>
                </div>
              </div>

              <div className="settings-block">
                <label className="settings-label" htmlFor="break-duration">
                  Break duration
                </label>
                <div className="settings-interval" title="15 seconds to 5 minutes">
                  <input
                    id="break-duration"
                    type="range"
                    min={BREAK_DURATION_LIMITS.min}
                    max={BREAK_DURATION_LIMITS.max}
                    step={BREAK_DURATION_LIMITS.step}
                    value={draft.breakDurationSeconds}
                    aria-valuetext={`${draft.breakDurationSeconds} seconds`}
                    style={breakRangeStyle}
                    onChange={(event) => change('breakDurationSeconds', Number(event.target.value))}
                  />
                  <output htmlFor="break-duration">
                    {draft.breakDurationSeconds}
                    <span>s</span>
                  </output>
                </div>
              </div>
              <div className="settings-block">
                <DurationChoices
                  name="snooze-duration"
                  label="Snooze duration"
                  values={[5, 10, 15]}
                  value={draft.snoozeDurationMinutes}
                  onChange={(value) => change('snoozeDurationMinutes', value)}
                />
              </div>
              <h2 className="settings-section-title settings-general-title">General</h2>
              <ToggleRow
                label="Launch automatically"
                checked={draft.launchAtLogin}
                onChange={(value) => change('launchAtLogin', value)}
                disabled
                title="Launch-at-login support is coming soon."
              />
              <div className="settings-rule">
                <ToggleRow
                  label="Sound notifications"
                  checked={draft.soundEnabled}
                  onChange={(value) => change('soundEnabled', value)}
                  disabled
                  title="Sound notifications are coming soon."
                />
              </div>
              <div className="settings-rule">
                <ToggleRow
                  label="Enable breaks"
                  checked={draft.breaksEnabled}
                  onChange={(value) => change('breaksEnabled', value)}
                />
              </div>
              <div className="settings-rule settings-action-row settings-reset-row">
                <span>Reset settings</span>
                <button
                  type="button"
                  className="settings-secondary"
                  onClick={() => setDraft({ ...DEFAULT_SETTINGS })}
                >
                  Reset settings
                </button>
              </div>
            </fieldset>
            {error && (
              <p className="settings-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <footer className="settings-footer">
            <button type="button" className="settings-cancel" onClick={() => window.close()}>
              Cancel
            </button>
            <button type="submit" className="settings-save" disabled={!loaded || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      </section>
    </main>
  )
}
