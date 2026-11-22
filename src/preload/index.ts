import { contextBridge, ipcRenderer } from 'electron'
import {
  APP_NAME,
  BREAK_SCHEDULE_CHANNELS,
  COMPANION_INTERACTIVE_CHANNEL,
  COMPANION_LAYOUT_CHANNELS,
  COMPANION_POINTER_CHANNEL,
  SETTINGS_CHANNELS
} from '../shared/constants'
import type {
  AppSettings,
  BreakScheduleState,
  CompanionLayout,
  CompanionPointerPosition,
  WigglebuddyAPI
} from '../shared/types'

// Expose only named capabilities; never pass raw Electron events to the renderer.
const api: WigglebuddyAPI = Object.freeze({
  appName: APP_NAME,
  openSettings: (): Promise<void> => ipcRenderer.invoke(SETTINGS_CHANNELS.open),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(SETTINGS_CHANNELS.read),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.save, settings),
  startBreakNow: (durationSeconds: number): Promise<void> =>
    ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.start, durationSeconds),
  startUpcomingBreak: (): Promise<void> =>
    ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.startUpcoming),
  finishBreak: (endsAt: number): Promise<void> =>
    ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.finish, endsAt),
  snoozeBreak: (): Promise<void> => ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.snooze),
  skipBreak: (): Promise<void> => ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.skip),
  getBreakSchedule: (): Promise<BreakScheduleState> =>
    ipcRenderer.invoke(BREAK_SCHEDULE_CHANNELS.read),
  getCompanionLayout: (): Promise<CompanionLayout> =>
    ipcRenderer.invoke(COMPANION_LAYOUT_CHANNELS.read),
  setCompanionInteractive: (interactive: boolean): Promise<void> =>
    ipcRenderer.invoke(COMPANION_INTERACTIVE_CHANNEL, interactive),
  onBreakScheduleChanged(listener: (schedule: BreakScheduleState) => void) {
    const handleSchedule = (
      _event: Electron.IpcRendererEvent,
      schedule: BreakScheduleState
    ): void => listener(schedule)
    ipcRenderer.on(BREAK_SCHEDULE_CHANNELS.changed, handleSchedule)
    return (): void => {
      ipcRenderer.removeListener(BREAK_SCHEDULE_CHANNELS.changed, handleSchedule)
    }
  },
  onCompanionPointerPosition(listener: (position: CompanionPointerPosition) => void) {
    const handlePosition = (
      _event: Electron.IpcRendererEvent,
      position: CompanionPointerPosition
    ): void => listener(position)

    ipcRenderer.on(COMPANION_POINTER_CHANNEL, handlePosition)
    return (): void => {
      ipcRenderer.removeListener(COMPANION_POINTER_CHANNEL, handlePosition)
    }
  }
})

contextBridge.exposeInMainWorld('wigglebuddy', api)
