export interface AppSettings {
  schemaVersion: 2
  breaksEnabled: boolean
  showPet: boolean
  reminderIntervalMinutes: number
  breakDurationSeconds: number
  snoozeDurationMinutes: number
  launchAtLogin: boolean
  soundEnabled: boolean
}

export interface WigglebuddyAPI {
  readonly appName: string
  openSettings(): Promise<void>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  startBreakNow(durationSeconds: number): Promise<void>
  getBreakSchedule(): Promise<BreakScheduleState>
  onBreakScheduleChanged(listener: (schedule: BreakScheduleState) => void): () => void
  onCompanionPointerPosition(listener: (position: CompanionPointerPosition) => void): () => void
}

export interface BreakState {
  endsAt: number
  durationSeconds: number
}

export interface BreakScheduleState {
  nextBreakAt: number | null
  activeBreak: BreakState | null
}

// Coordinates are relative to the companion window, never the desktop.
export type CompanionPointerPosition = { x: number; y: number } | null
