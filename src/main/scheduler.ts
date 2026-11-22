import type { AppSettings, BreakScheduleState, BreakState } from '../shared/types'

type SchedulePreferences = Pick<
  AppSettings,
  'breaksEnabled' | 'reminderIntervalMinutes' | 'breakDurationSeconds' | 'snoozeDurationMinutes'
>
interface BreakScheduler {
  getState(): BreakScheduleState
  update(settings: SchedulePreferences): BreakScheduleState
  tick(): BreakScheduleState
  startBreak(durationSeconds?: number): BreakScheduleState
  startUpcomingBreak(): BreakScheduleState
  snoozeBreak(): BreakScheduleState
  skipBreak(): BreakScheduleState
  finishBreak(): BreakScheduleState
}

// Deadlines live in the main process, independent of rendering and background ticks.
export function createBreakScheduler(initial: SchedulePreferences, now = Date.now): BreakScheduler {
  let preferences = { ...initial }
  let nextBreakAt = initial.breaksEnabled ? now() + initial.reminderIntervalMinutes * 60_000 : null
  let activeBreak: BreakState | null = null
  const isUpcoming = (): boolean =>
    !activeBreak &&
    preferences.breaksEnabled &&
    nextBreakAt !== null &&
    nextBreakAt > now() &&
    nextBreakAt - now() <= 10_000
  const state = (): BreakScheduleState => ({
    nextBreakAt,
    activeBreak: activeBreak && { ...activeBreak },
    breakUpcoming: isUpcoming()
  })
  const finish = (): void => {
    if (!activeBreak) return
    activeBreak = null
    nextBreakAt = preferences.breaksEnabled
      ? now() + preferences.reminderIntervalMinutes * 60_000
      : null
  }
  const start = (durationSeconds = preferences.breakDurationSeconds): void => {
    if (activeBreak) return
    activeBreak = { endsAt: now() + durationSeconds * 1000, durationSeconds }
    nextBreakAt = null
  }

  return {
    getState: state,
    update(settings): BreakScheduleState {
      const changed =
        settings.breaksEnabled !== preferences.breaksEnabled ||
        settings.reminderIntervalMinutes !== preferences.reminderIntervalMinutes
      preferences = { ...settings }
      if (activeBreak) {
        if (!settings.breaksEnabled) finish()
      } else if (changed) {
        nextBreakAt = settings.breaksEnabled
          ? now() + settings.reminderIntervalMinutes * 60_000
          : null
      }
      return state()
    },
    tick(): BreakScheduleState {
      if (activeBreak && now() >= activeBreak.endsAt) finish()
      if (
        !activeBreak &&
        preferences.breaksEnabled &&
        nextBreakAt !== null &&
        now() >= nextBreakAt
      ) {
        start()
      }
      return state()
    },
    startBreak(durationSeconds): BreakScheduleState {
      start(durationSeconds)
      return state()
    },
    startUpcomingBreak(): BreakScheduleState {
      if (isUpcoming()) start()
      return state()
    },
    snoozeBreak(): BreakScheduleState {
      if (isUpcoming()) nextBreakAt = now() + preferences.snoozeDurationMinutes * 60_000
      return state()
    },
    skipBreak(): BreakScheduleState {
      if (isUpcoming()) nextBreakAt = now() + preferences.reminderIntervalMinutes * 60_000
      return state()
    },
    finishBreak(): BreakScheduleState {
      finish()
      return state()
    }
  }
}
