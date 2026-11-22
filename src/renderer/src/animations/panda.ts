import { COMPANION_SPRITE_HEADROOM, COMPANION_WIDTH } from '../../../shared/constants'
import resting from '../assets/panda-sleep-natural-1536x1872.png'
import sittingUp from '../assets/panda-lying-to-sitting-fine.gif'
import sitting from '../assets/panda-sitting-head-bob-fine.gif'
import standingUp from '../assets/panda-sitting-to-standing-4-frames.gif'
import standing from '../assets/panda-standing-bounce.gif'

export type PandaMode = 'resting' | 'upcoming' | 'break'
type Phase = 'resting' | 'sitting-up' | 'sitting' | 'standing-up' | 'standing'
type Bounds = { left: number; top: number; right: number; bottom: number }
type Frame = { bitmap: ImageBitmap; duration: number; bounds: Bounds }
type Clip = { frames: Frame[]; duration: number }

export interface PandaPlayer {
  readonly ready: Promise<void>
  setMode(mode: PandaMode, cycle: number | null): void
  setReducedMotion(value: boolean): void
  hitTest(x: number, y: number): boolean
  dispose(): void
}

export const PANDA_STAGE_HEIGHT = COMPANION_SPRITE_HEADROOM + 112
const assets: Record<Phase, string> = {
  resting,
  'sitting-up': sittingUp,
  sitting,
  'standing-up': standingUp,
  standing
}
const labels: Record<Phase, string> = {
  resting: 'Resting panda. Drag to move wigglebuddy.',
  'sitting-up': 'Panda sitting up before a break.',
  sitting: 'Sitting panda waiting for a break.',
  'standing-up': 'Panda standing up for a break.',
  standing: 'Panda bouncing during the break.'
}

// One persistent canvas, one scale, and one source origin for every frame.
// Never crop or recenter individual poses: their shared 1536 × 1872 canvas
// already contains the intended movement, with the ground line at y = 1184.
export function createPandaPlayer(canvas: HTMLCanvasElement): PandaPlayer {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(COMPANION_WIDTH * ratio)
  canvas.height = Math.round(PANDA_STAGE_HEIGHT * ratio)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingEnabled = false
  const surface = new OffscreenCanvas(canvas.width, canvas.height)
  const paint = surface.getContext('2d', { willReadFrequently: true })!
  paint.imageSmoothingEnabled = false
  const clips = new Map<Phase, Clip>()
  const decoders = new Set<ImageDecoder>()
  const abort = new AbortController()
  let disposed = false
  let mode: PandaMode = 'resting'
  let cycle: number | null = null
  let phase: Phase = 'resting'
  let phaseStarted = performance.now()
  let reducedMotion = false
  let request = 0
  let lastBitmap: ImageBitmap | undefined
  let lastBounds: Bounds | undefined
  let fallback: Frame | undefined

  async function rasterize(image: CanvasImageSource, duration: number): Promise<Frame> {
    paint.setTransform(1, 0, 0, 1, 0, 0)
    paint.clearRect(0, 0, surface.width, surface.height)
    paint.setTransform(ratio, 0, 0, ratio, 0, 0)
    paint.drawImage(image, -54, COMPANION_SPRITE_HEADROOM - 111, 288, 351)
    const pixels = paint.getImageData(0, 0, surface.width, surface.height).data
    let left = surface.width,
      top = surface.height,
      right = 0,
      bottom = 0
    for (let y = 0; y < surface.height; y++) {
      for (let x = 0; x < surface.width; x++) {
        if (pixels[(y * surface.width + x) * 4 + 3] <= 16) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x + 1)
        bottom = Math.max(bottom, y + 1)
      }
    }
    return {
      bitmap: await createImageBitmap(surface),
      duration,
      bounds: { left: left / ratio, top: top / ratio, right: right / ratio, bottom: bottom / ratio }
    }
  }

  async function load(phase: Phase, url: string): Promise<void> {
    const frames: Frame[] = []
    let decoder: ImageDecoder | undefined
    try {
      const response = await fetch(url, { signal: abort.signal })
      if (!response.ok) throw new Error(`Could not load panda animation: ${phase}`)
      decoder = new ImageDecoder({
        data: await response.arrayBuffer(),
        type: url.endsWith('.png') ? 'image/png' : 'image/gif',
        preferAnimation: true
      })
      decoders.add(decoder)
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack?.frameCount ?? 0
      if (!count) throw new Error(`Panda animation has no frames: ${phase}`)
      for (let frameIndex = 0; frameIndex < count; frameIndex++) {
        if (disposed) return
        const { image } = await decoder.decode({ frameIndex })
        try {
          // Decode frame durations from the file, not from img.onload timers.
          frames.push(await rasterize(image, Math.max(1, (image.duration ?? 100_000) / 1000)))
        } finally {
          image.close()
        }
      }
      if (!disposed)
        clips.set(phase, {
          frames,
          duration: frames.reduce((sum, frame) => sum + frame.duration, 0)
        })
    } catch (error) {
      if (!disposed) console.error('Panda animation could not be decoded:', phase, error)
    } finally {
      if (decoder) {
        decoders.delete(decoder)
        decoder.close()
      }
      if (!clips.has(phase)) frames.forEach((frame) => frame.bitmap.close())
    }
  }

  function enter(next: Phase, started = performance.now()): void {
    phase = next
    phaseStarted = started
    canvas.dataset.phase = next
    canvas.setAttribute('aria-label', labels[next])
  }

  function draw(frame: Frame, index: number): void {
    if (lastBitmap === frame.bitmap) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(frame.bitmap, 0, 0)
    lastBitmap = frame.bitmap
    lastBounds = frame.bounds
    canvas.dataset.frame = String(index)
  }

  function tick(now: number): void {
    if (disposed) return
    let clip = clips.get(phase)
    let elapsed = now - phaseStarted
    // Both transition clips run exactly once. Carry elapsed time across their
    // boundaries so delayed paints cannot replay them or add a frozen hold.
    while (
      !reducedMotion &&
      clip &&
      elapsed >= clip.duration &&
      (phase === 'sitting-up' || phase === 'standing-up')
    ) {
      const started = phaseStarted + clip.duration
      enter(phase === 'sitting-up' ? 'sitting' : 'standing', started)
      clip = clips.get(phase)
      elapsed = now - phaseStarted
    }
    if (clip) {
      let time = reducedMotion ? 0 : elapsed % clip.duration
      let index = 0
      while (index < clip.frames.length - 1 && time >= clip.frames[index].duration)
        time -= clip.frames[index++].duration
      draw(clip.frames[index], index)
      canvas.dataset.ready = 'true'
    } else if (!lastBitmap && fallback) draw(fallback, 0)
    request = requestAnimationFrame(tick)
  }

  // A static first frame can appear while the frame caches are prepared.
  const ready = (async () => {
    const image = new Image()
    image.src = resting
    try {
      await image.decode()
      if (disposed) return
      const frame = await rasterize(image, 100)
      if (disposed) frame.bitmap.close()
      else fallback = frame
    } catch {
      // The frame decoder can still succeed if the static preview did not.
    }
    // Rasterization shares a small surface; prepare clips in order.
    for (const phase of Object.keys(assets) as Phase[]) {
      if (disposed) return
      await load(phase, assets[phase])
    }
    canvas.dataset.preloaded = 'true'
  })()
  enter('resting')
  request = requestAnimationFrame(tick)

  return {
    ready,
    setMode(nextMode: PandaMode, nextCycle: number | null): void {
      if (mode === nextMode && cycle === nextCycle) return
      mode = nextMode
      cycle = nextCycle
      enter(
        nextMode === 'resting'
          ? 'resting'
          : nextMode === 'upcoming'
            ? reducedMotion
              ? 'sitting'
              : 'sitting-up'
            : reducedMotion
              ? 'standing'
              : 'standing-up'
      )
    },
    setReducedMotion(value: boolean): void {
      if (reducedMotion === value) return
      reducedMotion = value
      enter(mode === 'resting' ? 'resting' : mode === 'upcoming' ? 'sitting' : 'standing')
    },
    hitTest(x: number, y: number): boolean {
      const bounds = lastBounds
      return (
        !!bounds &&
        x >= bounds.left - 2 &&
        x < bounds.right + 2 &&
        y >= bounds.top - 2 &&
        y < bounds.bottom + 2
      )
    },
    dispose(): void {
      disposed = true
      cancelAnimationFrame(request)
      abort.abort()
      decoders.forEach((decoder) => decoder.close())
      clips.forEach((clip) => clip.frames.forEach((frame) => frame.bitmap.close()))
      fallback?.bitmap.close()
    }
  }
}
