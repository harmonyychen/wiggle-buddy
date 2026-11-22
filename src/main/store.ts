import Store from 'electron-store'
import { BREAK_DURATION_LIMITS, DEFAULT_SETTINGS } from '../shared/constants'
import type { AppSettings } from '../shared/types'

export function isValidBreakDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= BREAK_DURATION_LIMITS.min &&
    value <= BREAK_DURATION_LIMITS.max &&
    value % BREAK_DURATION_LIMITS.step === 0
  )
}

// Validate at the main-process boundary, even though the form is typed.
export function validateSettings(input: unknown): AppSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid settings.')
  }
  const value = input as Record<string, unknown>
  const keys = Object.keys(DEFAULT_SETTINGS)
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error('Invalid settings.')
  if (
    value.schemaVersion !== 2 ||
    typeof value.breaksEnabled !== 'boolean' ||
    typeof value.showPet !== 'boolean' ||
    typeof value.launchAtLogin !== 'boolean' ||
    typeof value.soundEnabled !== 'boolean' ||
    typeof value.reminderIntervalMinutes !== 'number' ||
    !Number.isInteger(value.reminderIntervalMinutes) ||
    value.reminderIntervalMinutes < 5 ||
    value.reminderIntervalMinutes > 120 ||
    value.reminderIntervalMinutes % 5 !== 0 ||
    !isValidBreakDuration(value.breakDurationSeconds) ||
    typeof value.snoozeDurationMinutes !== 'number' ||
    ![5, 10, 15].includes(value.snoozeDurationMinutes)
  ) {
    throw new Error('Invalid settings.')
  }
  return {
    schemaVersion: value.schemaVersion,
    breaksEnabled: value.breaksEnabled,
    showPet: value.showPet,
    reminderIntervalMinutes: value.reminderIntervalMinutes,
    breakDurationSeconds: value.breakDurationSeconds,
    snoozeDurationMinutes: value.snoozeDurationMinutes,
    launchAtLogin: value.launchAtLogin,
    soundEnabled: value.soundEnabled
  }
}

export function migrateSettings(saved: Record<string, unknown>): AppSettings {
  if (saved.schemaVersion === 2) return validateSettings(saved)
  if (saved.schemaVersion !== undefined && saved.schemaVersion !== 1) {
    throw new Error('Unsupported settings version.')
  }
  // The new seconds slider starts at 90 s. Preserve all other existing choices.
  return validateSettings({
    ...DEFAULT_SETTINGS,
    breaksEnabled: saved.remindersEnabled ?? DEFAULT_SETTINGS.breaksEnabled,
    showPet: saved.showPet ?? DEFAULT_SETTINGS.showPet,
    reminderIntervalMinutes:
      saved.reminderIntervalMinutes ?? DEFAULT_SETTINGS.reminderIntervalMinutes,
    snoozeDurationMinutes: saved.snoozeDurationMinutes ?? DEFAULT_SETTINGS.snoozeDurationMinutes,
    launchAtLogin: saved.launchAtLogin ?? DEFAULT_SETTINGS.launchAtLogin,
    soundEnabled: saved.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled
  })
}

// Migrate the old schema before enabling validation for the seconds-based format.
export function createSettingsStore(): Store<AppSettings> {
  const previous = new Store<Record<string, unknown>>({ name: 'settings' })
  const normalized = migrateSettings(previous.store)
  if (previous.store.schemaVersion !== 2) previous.store = { ...normalized }

  return new Store<AppSettings>({
    name: 'settings',
    defaults: { ...DEFAULT_SETTINGS },
    schema: {
      schemaVersion: { type: 'number', const: 2 },
      breaksEnabled: { type: 'boolean' },
      showPet: { type: 'boolean' },
      reminderIntervalMinutes: { type: 'integer', minimum: 5, maximum: 120, multipleOf: 5 },
      breakDurationSeconds: {
        type: 'integer',
        minimum: BREAK_DURATION_LIMITS.min,
        maximum: BREAK_DURATION_LIMITS.max,
        multipleOf: BREAK_DURATION_LIMITS.step
      },
      snoozeDurationMinutes: { type: 'number', enum: [5, 10, 15] },
      launchAtLogin: { type: 'boolean' },
      soundEnabled: { type: 'boolean' }
    }
  })
}
