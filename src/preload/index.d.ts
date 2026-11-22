import type { WigglebuddyAPI } from '../shared/types'

declare global {
  interface Window {
    readonly wigglebuddy: WigglebuddyAPI
  }
}
