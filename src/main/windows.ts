import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { APP_NAME, COMPANION_POINTER_CHANNEL } from '../shared/constants'
import type { BreakState, CompanionPointerPosition } from '../shared/types'

let companionWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let companionVisible = true
let presentedBreak: BreakState | null = null
const breakOverlays = new Map<number, BrowserWindow>()
let escapeBreakHandler: (() => void) | undefined

export function onBreakEscape(handler: () => void): void {
  escapeBreakHandler = handler
}

export function getCompanionWindow(): BrowserWindow | null {
  return companionWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function setCompanionVisibility(visible: boolean): void {
  companionVisible = visible
  if (!companionWindow || companionWindow.isDestroyed()) return
  if (visible || presentedBreak) companionWindow.showInactive()
  else companionWindow.hide()
}

function secureWindow(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (!presentedBreak) return
    // Keep an immediate way out; do not register or suppress OS-wide shortcuts.
    const quitShortcut =
      (process.platform === 'darwin' ? input.meta : input.control) &&
      !input.alt &&
      !input.shift &&
      input.key.toLowerCase() === 'q'
    if (quitShortcut) return
    event.preventDefault()
    if (input.type === 'keyDown' && input.key === 'Escape') {
      escapeBreakHandler?.()
    }
  })
  window.webContents.on('before-mouse-event', (event) => {
    if (presentedBreak) {
      event.preventDefault()
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
}

async function loadRenderer(
  window: BrowserWindow,
  page: 'companion' | 'settings' | 'break'
): Promise<void> {
  const developmentUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && developmentUrl) {
    await window.loadURL(`${developmentUrl}#${page}`)
  } else {
    await window.loadFile(join(import.meta.dirname, '../renderer/index.html'), { hash: page })
  }
}

export async function createCompanionWindow(visible = true): Promise<BrowserWindow> {
  companionVisible = visible
  const { workArea } = screen.getPrimaryDisplay()
  const width = 180
  // Reserve enough transparent space for the expanded bar without resizing.
  const height = 184
  const margin = 24

  const window = new BrowserWindow({
    title: APP_NAME,
    width,
    height,
    x: Math.max(workArea.x, workArea.x + workArea.width - width - margin),
    y: Math.max(workArea.y, workArea.y + workArea.height - height - margin),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  companionWindow = window
  window.once('closed', () => {
    companionWindow = null
    if (presentedBreak) escapeBreakHandler?.()
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  })

  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // Appear without taking keyboard focus from the app the user is working in.
  window.once('ready-to-show', () => {
    if (companionVisible || presentedBreak) window.showInactive()
  })
  secureWindow(window)

  // Native drag regions suppress DOM pointer events. Only forward window-local
  // coordinates while inside the companion, plus one notification on leaving.
  let pointerWasInside = false
  const pointerInterval = setInterval(() => {
    if (!window.isVisible() && !pointerWasInside) return
    const bounds = window.getContentBounds()
    const cursor = screen.getCursorScreenPoint()
    const x = cursor.x - bounds.x
    const y = cursor.y - bounds.y
    const inside = window.isVisible() && x >= 0 && y >= 0 && x < bounds.width && y < bounds.height
    if (!inside && !pointerWasInside) return

    const position: CompanionPointerPosition = inside ? { x, y } : null
    window.webContents.send(COMPANION_POINTER_CHANNEL, position)
    pointerWasInside = inside
  }, 75)
  window.once('closed', () => clearInterval(pointerInterval))

  await loadRenderer(window, 'companion')

  return window
}

function positionSettingsWindow(pet: BrowserWindow, popup: BrowserWindow): void {
  const bounds = pet.getBounds()
  const area = screen.getDisplayMatching(bounds).workArea
  const width = Math.min(336, area.width - 16)
  const height = Math.min(736, area.height - 16)
  const gap = 4
  const right = bounds.x + bounds.width + gap
  const desiredX = right + width <= area.x + area.width - 8 ? right : bounds.x - width - gap
  const x = Math.round(Math.max(area.x + 8, Math.min(desiredX, area.x + area.width - width - 8)))
  const desiredY = bounds.y + bounds.height / 2 - height / 2
  const y = Math.round(Math.max(area.y + 8, Math.min(desiredY, area.y + area.height - height - 8)))
  popup.setBounds({ x, y, width, height })
}

export async function openSettingsWindow(): Promise<void> {
  if (presentedBreak) return
  const pet = companionWindow
  if (!pet || pet.isDestroyed()) return
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    positionSettingsWindow(pet, settingsWindow)
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  const popup = new BrowserWindow({
    title: `${APP_NAME} Settings`,
    width: 336,
    height: 736,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  settingsWindow = popup
  popup.on('page-title-updated', (event) => event.preventDefault())
  secureWindow(popup)
  const reposition = (): void => {
    if (!popup.isDestroyed() && !pet.isDestroyed()) positionSettingsWindow(pet, popup)
  }
  reposition()
  pet.on('move', reposition)
  popup.once('closed', () => {
    pet.removeListener('move', reposition)
    settingsWindow = null
  })
  popup.once('ready-to-show', () => {
    if (!presentedBreak) popup.show()
  })

  try {
    await loadRenderer(popup, 'settings')
  } catch (error) {
    if (!popup.isDestroyed()) popup.close()
    throw error
  }
}

function raiseCompanion(): void {
  if (!presentedBreak || !companionWindow || companionWindow.isDestroyed()) return
  companionWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  companionWindow.showInactive()
  companionWindow.moveTop()
}

async function reconcileBreakOverlays(): Promise<void> {
  if (!presentedBreak) return
  const displays = screen.getAllDisplays()
  const ids = new Set(displays.map((display) => display.id))
  for (const [id, overlay] of breakOverlays) {
    if (!ids.has(id)) {
      breakOverlays.delete(id)
      if (!overlay.isDestroyed()) overlay.close()
    }
  }
  await Promise.all(
    displays.map(async (display) => {
      const existing = breakOverlays.get(display.id)
      if (existing && !existing.isDestroyed()) {
        existing.setBounds(display.bounds)
        return
      }
      const overlay = new BrowserWindow({
        title: `${APP_NAME} Break`,
        ...display.bounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        roundedCorners: false,
        enableLargerThanScreen: true,
        show: false,
        focusable: true,
        skipTaskbar: true,
        movable: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        webPreferences: {
          preload: join(import.meta.dirname, '../preload/index.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })
      breakOverlays.set(display.id, overlay)
      overlay.once('closed', () => {
        if (breakOverlays.get(display.id) !== overlay) return
        breakOverlays.delete(display.id)
        if (presentedBreak) escapeBreakHandler?.()
      })
      secureWindow(overlay)
      overlay.on('page-title-updated', (event) => event.preventDefault())
      overlay.setAlwaysOnTop(true, 'screen-saver')
      // Consume input at the native window instead of passing it to apps below.
      overlay.setIgnoreMouseEvents(false)
      if (process.platform === 'darwin') {
        overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      }
      overlay.setBounds(display.bounds)
      try {
        await loadRenderer(overlay, 'break')
        if (!presentedBreak || breakOverlays.get(display.id) !== overlay || overlay.isDestroyed())
          return
        overlay.showInactive()
        raiseCompanion()
      } catch (error) {
        if (presentedBreak && breakOverlays.get(display.id) === overlay) {
          escapeBreakHandler?.()
          throw error
        }
      }
    })
  )
  raiseCompanion()
}

export async function presentBreak(state: BreakState | null): Promise<void> {
  const previous = presentedBreak
  presentedBreak = state
  if (!state) {
    for (const overlay of breakOverlays.values()) {
      if (!overlay.isDestroyed()) overlay.close()
    }
    breakOverlays.clear()
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.setMovable(true)
      companionWindow.setAlwaysOnTop(true, 'floating')
      setCompanionVisibility(companionVisible)
    }
    return
  }
  if (!previous) {
    // Preserve draft edits for the next deliberate open, without reopening on completion.
    settingsWindow?.hide()
  }
  companionWindow?.setMovable(false)
  raiseCompanion()
  await reconcileBreakOverlays()
  if (!previous && presentedBreak === state) {
    // Take keyboard focus once at the start, rather than fighting app switching.
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const overlay = breakOverlays.get(display.id)
    if (overlay && !overlay.isDestroyed()) {
      overlay.show()
      overlay.webContents.focus()
      raiseCompanion()
    }
  }
}

export function watchBreakDisplays(): void {
  const update = (): void => {
    if (!presentedBreak) return
    void reconcileBreakOverlays().catch((error) => {
      console.error('Could not update break displays:', error)
      escapeBreakHandler?.()
    })
  }
  screen.on('display-added', update)
  screen.on('display-removed', update)
  screen.on('display-metrics-changed', update)
  app.once('will-quit', () => {
    screen.removeListener('display-added', update)
    screen.removeListener('display-removed', update)
    screen.removeListener('display-metrics-changed', update)
  })
}
