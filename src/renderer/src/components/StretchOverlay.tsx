// The panda owns the break countdown; the display layer contains no visible UI.
export default function StretchOverlay(): React.JSX.Element {
  return <div className="break-overlay" aria-hidden="true" />
}
