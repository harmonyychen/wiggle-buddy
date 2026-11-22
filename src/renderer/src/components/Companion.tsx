import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Settings, TimerReset } from 'lucide-react'
import { COMPANION_SPRITE_HEADROOM, COMPANION_WIDTH } from '../../../shared/constants'
import type { BreakScheduleState, CompanionLayout } from '../../../shared/types'
import PandaSprite, { type PandaSpriteHandle } from './PandaSprite'

export default function Companion(): React.JSX.Element {
  const [controlsExpanded, setControlsExpanded] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [schedule, setSchedule] = useState<BreakScheduleState | null>(null)
  const [clockNow, setClockNow] = useState(Date.now)
  const [countdownFailed, setCountdownFailed] = useState(false)
  const [controlsError, setControlsError] = useState('')
  const [breakActionPending, setBreakActionPending] = useState(false)
  const [layout, setLayout] = useState<CompanionLayout>({
    offsetX: 0,
    offsetY: COMPANION_SPRITE_HEADROOM,
    windowWidth: COMPANION_WIDTH
  })
  const spriteRef = useRef<PandaSpriteHandle>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const inputCaptured = useRef(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const pointerInside = useRef(false)
  const collapseTimeout = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(collapseTimeout.current), [])

  useEffect(() => {
    let active = true
    const receiveSchedule = (next: BreakScheduleState): void => {
      if (!active) return
      setSchedule(next)
      setClockNow(Date.now())
      setCountdownFailed(false)
    }
    const unsubscribe = window.wigglebuddy.onBreakScheduleChanged(receiveSchedule)
    const receiveLayout = (next: CompanionLayout): void => {
      if (active) setLayout(next)
    }
    void window.wigglebuddy.getCompanionLayout().then(receiveLayout, () => {
      if (active)
        setControlsError('Companion controls could not be loaded. Please restart the app.')
    })
    void window.wigglebuddy.getBreakSchedule().then(receiveSchedule, () => {
      if (active) setCountdownFailed(true)
    })
    const clock = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => {
      active = false
      unsubscribe()
      window.clearInterval(clock)
    }
  }, [])

  const expandControls = useCallback((): void => {
    window.clearTimeout(collapseTimeout.current)
    setControlsExpanded(true)
    setClockNow(Date.now())
  }, [])

  const scheduleCollapse = useCallback((): void => {
    window.clearTimeout(collapseTimeout.current)
    // Keep the controls visible while navigating them with the keyboard.
    const active = document.activeElement
    const keyboardFocus = controlsRef.current?.contains(active) && active?.matches(':focus-visible')
    if (pointerInside.current || keyboardFocus) return
    collapseTimeout.current = window.setTimeout(() => setControlsExpanded(false), 1000)
  }, [])

  useEffect(
    () =>
      window.wigglebuddy.onCompanionPointerPosition((position) => {
        const bounds = barRef.current?.getBoundingClientRect()
        const inside =
          position !== null &&
          (!!spriteRef.current?.hitTest(position.x, position.y) ||
            (!!bounds &&
              position.x >= bounds.left &&
              position.x < bounds.right &&
              position.y >= bounds.top &&
              position.y < bounds.bottom))
        if (inside !== inputCaptured.current) {
          inputCaptured.current = inside
          void window.wigglebuddy.setCompanionInteractive(inside).catch(() => {
            setControlsError('Companion input could not be updated. Please restart the app.')
          })
        }

        if (inside === pointerInside.current) return
        pointerInside.current = inside
        if (inside) expandControls()
        else scheduleCollapse()
      }),
    [expandControls, scheduleCollapse]
  )

  const breakEndsAt = schedule?.activeBreak?.endsAt
  const breakActive = breakEndsAt !== undefined
  const breakUpcoming = !!schedule?.breakUpcoming
  const expanded = controlsExpanded || breakActive || breakUpcoming
  const showCountdown = !breakUpcoming && (timerOpen || breakActive)
  const deadline = breakEndsAt ?? schedule?.nextBreakAt
  const remainingSeconds = deadline ? Math.max(0, Math.ceil((deadline - clockNow) / 1000)) : 0
  const countdownText = countdownFailed
    ? 'Unavailable'
    : !schedule
      ? '--:--'
      : deadline === null
        ? 'Paused'
        : `${Math.floor(remainingSeconds / 60)
            .toString()
            .padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`
  const countdownLabel = countdownFailed
    ? 'Break countdown unavailable'
    : breakActive
      ? `${countdownText} remaining in break`
      : schedule?.nextBreakAt === null
        ? 'Breaks are paused'
        : `Next break in ${countdownText}`

  async function handleBreakAction(action: () => Promise<void>): Promise<void> {
    if (breakActionPending) return
    setBreakActionPending(true)
    setControlsError('')
    try {
      await action()
      setControlsExpanded(false)
    } catch {
      setControlsError('The break action could not be completed. Please try again.')
    } finally {
      setBreakActionPending(false)
    }
  }

  return (
    <main
      className="companion"
      aria-label="wigglebuddy desktop companion"
      data-break-active={breakActive}
    >
      <div
        className="companion-placement"
        style={
          {
            width: COMPANION_WIDTH,
            transform: `translate(${layout.offsetX}px, ${layout.offsetY}px)`,
            '--prompt-center': `${layout.windowWidth / 2 - layout.offsetX}px`
          } as CSSProperties
        }
      >
        <PandaSprite
          ref={spriteRef}
          mode={breakActive ? 'break' : breakUpcoming ? 'upcoming' : 'resting'}
          cycle={breakEndsAt ?? (breakUpcoming ? (schedule?.nextBreakAt ?? null) : null)}
        />
        <div
          ref={controlsRef}
          className="companion-controls"
          role="group"
          aria-label="Companion controls"
          tabIndex={breakUpcoming || breakActive ? -1 : 0}
          data-expanded={expanded}
          data-timer-open={showCountdown}
          data-upcoming={breakUpcoming}
          onFocus={expandControls}
          onBlur={scheduleCollapse}
        >
          <div ref={barRef} className="companion-bar">
            <div className="companion-toolbar" aria-hidden={!expanded || breakUpcoming}>
              <button
                type="button"
                aria-label="Timer"
                disabled={breakActive || breakUpcoming}
                title={
                  breakActive
                    ? undefined
                    : timerOpen
                      ? 'Hide countdown'
                      : 'Time until the next break'
                }
                aria-pressed={showCountdown}
                aria-expanded={showCountdown && expanded}
                aria-controls="next-break-countdown"
                tabIndex={expanded && !breakUpcoming ? 0 : -1}
                onClick={() => {
                  if (breakActive) return
                  setTimerOpen((open) => !open)
                  setClockNow(Date.now())
                }}
              >
                <TimerReset size={20} strokeWidth={1.6} aria-hidden="true" />
              </button>
              <span className="companion-bar-divider" aria-hidden="true" />
              <div className="companion-countdown-slot" aria-hidden={!showCountdown || !expanded}>
                <output
                  id="next-break-countdown"
                  className="companion-countdown"
                  role="timer"
                  aria-label={countdownLabel}
                  aria-live="off"
                  data-status={
                    (!breakActive && schedule?.nextBreakAt === null) || countdownFailed
                      ? 'message'
                      : 'countdown'
                  }
                >
                  {countdownText}
                </output>
                <span className="companion-bar-divider" aria-hidden="true" />
              </div>
              {breakActive ? (
                <button
                  key="quit-break"
                  type="button"
                  aria-label="Quit break"
                  title="End this break early"
                  disabled={breakActionPending}
                  onClick={() =>
                    void handleBreakAction(() => window.wigglebuddy.finishBreak(breakEndsAt))
                  }
                >
                  <span className="companion-quit-label">Quit</span>
                </button>
              ) : (
                <button
                  key="settings"
                  type="button"
                  aria-label="Settings"
                  title="Settings"
                  disabled={breakUpcoming}
                  tabIndex={expanded && !breakUpcoming ? 0 : -1}
                  onClick={() => {
                    setControlsError('')
                    void window.wigglebuddy.openSettings().catch(() => {
                      setControlsError('Settings could not be opened. Please try again.')
                    })
                  }}
                >
                  <Settings size={20} strokeWidth={1.6} aria-hidden="true" />
                </button>
              )}
            </div>
            <div
              className="companion-prompt-toolbar"
              role="group"
              aria-label="Upcoming break"
              aria-hidden={!breakUpcoming}
            >
              <span className="companion-prompt-icon" aria-hidden="true">
                <TimerReset size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="companion-bar-divider" aria-hidden="true" />
              <output
                className="companion-prompt-countdown"
                role="timer"
                aria-label={countdownLabel}
                aria-live="off"
              >
                {breakUpcoming ? countdownText : ''}
              </output>
              <button
                type="button"
                className="companion-prompt-start"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction(window.wigglebuddy.startUpcomingBreak)}
              >
                Start Now
              </button>
              <button
                type="button"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction(window.wigglebuddy.snoozeBreak)}
              >
                Snooze
              </button>
              <button
                type="button"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction(window.wigglebuddy.skipBreak)}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
        {controlsError && !breakActive && (
          <p className="companion-error" role="alert">
            {controlsError}
          </p>
        )}
      </div>
    </main>
  )
}
