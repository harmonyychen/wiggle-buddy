import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Settings, TimerReset } from 'lucide-react'
import { COMPANION_WIDTH } from '../../../shared/constants'
import type { BreakScheduleState, CompanionLayout } from '../../../shared/types'
import restingAnimation from '../assets/panda-sleep-natural-1536x1872.png'
import restingImage from '../assets/default-panda.png'

export default function Companion(): React.JSX.Element {
  const [animationFailed, setAnimationFailed] = useState(false)
  const [controlsExpanded, setControlsExpanded] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [schedule, setSchedule] = useState<BreakScheduleState | null>(null)
  const [clockNow, setClockNow] = useState(Date.now)
  const [countdownFailed, setCountdownFailed] = useState(false)
  const [controlsError, setControlsError] = useState('')
  const [breakActionPending, setBreakActionPending] = useState(false)
  const [layout, setLayout] = useState<CompanionLayout>({
    offsetX: 0,
    windowWidth: COMPANION_WIDTH
  })
  const spriteRef = useRef<HTMLPictureElement>(null)
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
    const unsubscribeLayout = window.wigglebuddy.onCompanionLayoutChanged(receiveLayout)
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
      unsubscribeLayout()
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
        const inside =
          position !== null &&
          [spriteRef.current, controlsRef.current].some((element) => {
            if (!element) return false
            const bounds = element.getBoundingClientRect()
            return (
              position.x >= bounds.left &&
              position.x < bounds.right &&
              position.y >= bounds.top &&
              position.y < bounds.bottom
            )
          })

        if (inside === pointerInside.current) return
        pointerInside.current = inside
        if (inside) expandControls()
        else scheduleCollapse()
      }),
    [expandControls, scheduleCollapse]
  )

  const breakActive = !!schedule?.activeBreak
  const breakUpcoming = !!schedule?.breakUpcoming
  const expanded = controlsExpanded || breakActive || breakUpcoming
  const showCountdown = !breakUpcoming && (timerOpen || breakActive)
  const deadline = schedule?.activeBreak?.endsAt ?? schedule?.nextBreakAt
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

  async function handleBreakAction(action: 'start' | 'snooze' | 'skip'): Promise<void> {
    if (!breakUpcoming || breakActionPending) return
    setBreakActionPending(true)
    setControlsError('')
    try {
      if (action === 'start') await window.wigglebuddy.startUpcomingBreak()
      else if (action === 'snooze') await window.wigglebuddy.snoozeBreak()
      else await window.wigglebuddy.skipBreak()
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
            transform: `translateX(${layout.offsetX}px)`,
            '--prompt-center': `${layout.windowWidth / 2 - layout.offsetX}px`
          } as CSSProperties
        }
      >
        <picture
          ref={spriteRef}
          className="companion-sprite"
          data-static={animationFailed || undefined}
        >
          <source media="(prefers-reduced-motion: reduce)" srcSet={restingImage} />
          <img
            className="companion-image"
            src={animationFailed ? restingImage : restingAnimation}
            alt="Resting panda. Drag to move wigglebuddy."
            draggable={false}
            onError={() => setAnimationFailed(true)}
          />
        </picture>
        <div
          ref={controlsRef}
          className="companion-controls"
          role="group"
          aria-label="Companion controls"
          tabIndex={breakUpcoming ? -1 : 0}
          data-expanded={expanded}
          data-timer-open={showCountdown}
          data-upcoming={breakUpcoming}
          onFocus={expandControls}
          onBlur={scheduleCollapse}
        >
          <div className="companion-bar">
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
              <button
                type="button"
                aria-label="Settings"
                title={breakActive ? undefined : 'Settings'}
                disabled={breakActive || breakUpcoming}
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
            </div>
            <div
              className="companion-prompt-toolbar"
              role="group"
              aria-label="Upcoming break"
              aria-hidden={!breakUpcoming}
            >
              <span className="companion-prompt-icon" role="img" aria-label={countdownLabel}>
                <TimerReset size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="companion-bar-divider" aria-hidden="true" />
              <button
                type="button"
                className="companion-prompt-start"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction('start')}
              >
                Start Now
              </button>
              <button
                type="button"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction('snooze')}
              >
                Snooze
              </button>
              <button
                type="button"
                disabled={!breakUpcoming || breakActionPending}
                onClick={() => void handleBreakAction('skip')}
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
