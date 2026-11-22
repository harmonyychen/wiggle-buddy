import Companion from './components/Companion'
import Settings from './components/Settings'
import StretchOverlay from './components/StretchOverlay'

export default function App(): React.JSX.Element {
  if (window.location.hash === '#settings') return <Settings />
  if (window.location.hash === '#break') return <StretchOverlay />
  return <Companion />
}
