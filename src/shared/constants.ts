import type { AppSettings } from './types'

export const APP_NAME = 'wigglebuddy'
export const COMPANION_POINTER_CHANNEL = 'companion:pointer-position'
export const COMPANION_LAYOUT_CHANNELS = {
  read: 'companion:layout'
} as const
export const COMPANION_INTERACTIVE_CHANNEL = 'companion:set-interactive'
export const COMPANION_WIDTH = 180
export const COMPANION_HEIGHT = 184
export const COMPANION_PROMPT_WIDTH = 296
export const COMPANION_SPRITE_HEADROOM = 64
export const SETTINGS_CHANNELS = {
  open: 'settings:open',
  read: 'settings:read',
  save: 'settings:save'
} as const
export const BREAK_SCHEDULE_CHANNELS = {
  start: 'break-schedule:start',
  startUpcoming: 'break-schedule:start-upcoming',
  snooze: 'break-schedule:snooze',
  skip: 'break-schedule:skip',
  read: 'break-schedule:read',
  changed: 'break-schedule:changed'
} as const
export const BREAK_DURATION_LIMITS = { min: 15, max: 300, step: 15 } as const

export const DEFAULT_SETTINGS = {
  schemaVersion: 2,
  breaksEnabled: true,
  showPet: true,
  reminderIntervalMinutes: 30,
  breakDurationSeconds: 90,
  snoozeDurationMinutes: 5,
  launchAtLogin: false,
  soundEnabled: false
} as const satisfies Readonly<AppSettings>
