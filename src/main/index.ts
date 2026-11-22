import { app, ipcMain, session, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import {
  APP_NAME,
  BREAK_SCHEDULE_CHANNELS,
  COMPANION_LAYOUT_CHANNELS,
  SETTINGS_CHANNELS
} from '../shared/constants'
import { createBreakScheduler } from './scheduler'
import { createSettingsStore, isValidBreakDuration, validateSettings } from './store'
import {
  createCompanionWindow,
  getCompanionLayout,
  getCompanionWindow,
  getSettingsWindow,
  onBreakEscape,
  openSettingsWindow,
  presentBreak,
  setCompanionVisibility,
  setUpcomingBreakVisible,
  watchBreakDisplays
} from './windows'

app.setName(APP_NAME)

function assertSender(event: IpcMainInvokeEvent, window: BrowserWindow | null): void {
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame
  ) {
    throw new Error('Untrusted window request.')
  }
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)

  const store = createSettingsStore()
  const scheduler = createBreakScheduler(store.store)
  let lastState = ''
  let lastPresentation = 'null'
  let quitting = false

  async function publishSchedule(): Promise<void> {
    if (quitting) return
    const state = scheduler.getState()
    const key = JSON.stringify(state)
    if (key === lastState) return
    lastState = key
    setUpcomingBreakVisible(state.breakUpcoming)
    getCompanionWindow()?.webContents.send(BREAK_SCHEDULE_CHANNELS.changed, state)
    const presentation = JSON.stringify(state.activeBreak)
    if (presentation === lastPresentation) return
    lastPresentation = presentation
    try {
      await presentBreak(state.activeBreak)
    } catch (error) {
      if (!quitting && scheduler.getState().activeBreak?.endsAt === state.activeBreak?.endsAt) {
        scheduler.finishBreak()
        await publishSchedule()
      }
      throw error
    }
  }

  ipcMain.handle(BREAK_SCHEDULE_CHANNELS.read, (event) => {
    assertSender(event, getCompanionWindow())
    scheduler.tick()
    void publishSchedule().catch(console.error)
    return scheduler.getState()
  })
  ipcMain.handle(COMPANION_LAYOUT_CHANNELS.read, (event) => {
    assertSender(event, getCompanionWindow())
    return getCompanionLayout()
  })
  ipcMain.handle(BREAK_SCHEDULE_CHANNELS.startUpcoming, async (event) => {
    assertSender(event, getCompanionWindow())
    scheduler.tick()
    scheduler.startUpcomingBreak()
    await publishSchedule()
  })
  ipcMain.handle(BREAK_SCHEDULE_CHANNELS.snooze, async (event) => {
    assertSender(event, getCompanionWindow())
    scheduler.tick()
    scheduler.snoozeBreak()
    await publishSchedule()
  })
  ipcMain.handle(BREAK_SCHEDULE_CHANNELS.skip, async (event) => {
    assertSender(event, getCompanionWindow())
    scheduler.tick()
    scheduler.skipBreak()
    await publishSchedule()
  })
  ipcMain.handle(SETTINGS_CHANNELS.open, (event) => {
    assertSender(event, getCompanionWindow())
    return openSettingsWindow()
  })
  ipcMain.handle(SETTINGS_CHANNELS.read, (event) => {
    assertSender(event, getSettingsWindow())
    return store.store
  })
  ipcMain.handle(SETTINGS_CHANNELS.save, async (event, input: unknown) => {
    assertSender(event, getSettingsWindow())
    const settings = validateSettings(input)
    store.store = settings
    setCompanionVisibility(settings.showPet)
    scheduler.update(settings)
    await publishSchedule()
  })
  ipcMain.handle(BREAK_SCHEDULE_CHANNELS.start, async (event, duration: unknown) => {
    assertSender(event, getSettingsWindow())
    if (!isValidBreakDuration(duration)) throw new Error('Invalid break duration.')
    scheduler.startBreak(duration)
    await publishSchedule()
  })

  await createCompanionWindow(store.store.showPet)
  watchBreakDisplays()
  onBreakEscape(() => {
    scheduler.finishBreak()
    void publishSchedule().catch(console.error)
  })
  await publishSchedule()
  if (!store.store.showPet) await openSettingsWindow()

  const clock = setInterval(() => {
    scheduler.tick()
    void publishSchedule().catch(console.error)
  }, 250)
  app.once('before-quit', () => {
    quitting = true
    clearInterval(clock)
  })
  app.on('activate', async () => {
    if (!getCompanionWindow()) await createCompanionWindow(store.store.showPet)
    if (
      store.store.showPet ||
      scheduler.getState().activeBreak ||
      scheduler.getState().breakUpcoming
    ) {
      setCompanionVisibility(store.store.showPet)
    } else {
      await openSettingsWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
