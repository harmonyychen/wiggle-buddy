import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { COMPANION_SPRITE_HEADROOM, COMPANION_WIDTH } from '../../../shared/constants'
import { createPandaPlayer, PANDA_STAGE_HEIGHT, type PandaMode } from '../animations/panda'

export interface PandaSpriteHandle {
  hitTest(x: number, y: number): boolean
}

type Props = { mode: PandaMode; cycle: number | null; ref?: Ref<PandaSpriteHandle> }

export default function PandaSprite({ mode, cycle, ref }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playerRef = useRef<ReturnType<typeof createPandaPlayer> | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      hitTest(x, y): boolean {
        const box = canvasRef.current?.getBoundingClientRect()
        return !!box && !!playerRef.current?.hitTest(x - box.left, y - box.top)
      }
    }),
    []
  )

  useEffect(() => {
    const player = createPandaPlayer(canvasRef.current!)
    playerRef.current = player
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = (): void => player.setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener('change', updateMotion)
    return () => {
      media.removeEventListener('change', updateMotion)
      player.dispose()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    playerRef.current?.setMode(mode, cycle)
  }, [mode, cycle])

  return (
    <div
      className="companion-sprite"
      style={{
        top: -COMPANION_SPRITE_HEADROOM,
        width: COMPANION_WIDTH,
        height: PANDA_STAGE_HEIGHT
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="wigglebuddy panda" />
    </div>
  )
}
