# wigglebuddy

wiggle buddy is a macOS desktop companion that reminds you to get up and stretch. The panda rests above other applications in a frameless, draggable window. Scheduled breaks, immediate breaks, and a next-break countdown are available. Screen-time tracking remains future work.

## Stack
Electron, React, TypeScript, electron-vite, Tailwind CSS, electron-store, Lucide React.

## Development

```sh
npm install
npm run dev
```

Use `npm ci` for a clean install from the lockfile. Installation downloads Electron for the host architecture.

```sh
npm run typecheck  # Check main/preload/shared and renderer types
npm run build     # Type-check and compile into out/
npm start         # Preview the compiled app
npm run lint
npm run format:check
npm run format
```

The `out/` directory is generated as needed and ignored by Git. Installer packaging is deferred until distribution is needed.

## Architecture

- `src/main/`: Electron lifecycle, the floating companion window, and settings persistence. The scheduler owns the session deadline and active break lifecycle; activity, context, and rules remain placeholders.
- `src/preload/`: Sandboxed communication boundary and window typings. Exposes application metadata, companion-local pointer events, and named settings open/read/save methods. Settings IPC validates the sending window and main frame.
- `src/renderer/`: React entry point, panda companion, settings panel, break overlay, Tailwind stylesheet, and a custom timer placeholder.
- `src/shared/`: Process-independent types and defaults. Keep Node and Electron imports out of this directory.

Create hooks, animation utilities, native integration, and browser-extension directories when their implementation begins.

The main process uses ESM for electron-store; the preload is bundled as CommonJS for Electron's sandbox. Context isolation and sandboxing are enabled, renderer Node integration is disabled, and navigation, new windows, and permission requests are blocked. The production CSP disallows inline scripts; development adds a per-launch nonce for React Refresh. Future privileged operations should use explicitly named preload methods, validated arguments, and main-process sender validation.

The navigation bar displays the time until the next break and switches to the active break countdown automatically. Scheduled and immediate breaks share the same lifecycle and dimming presentation. Notifications, tracking, and extension functionality are not implemented yet. No feature-specific macOS permissions or entitlements are configured. Saved preferences restore pet visibility at startup and establish the session deadline.

If a development host sets `ELECTRON_RUN_AS_NODE`, unset it before launching Electron:

```sh
env -u ELECTRON_RUN_AS_NODE npm run dev
```

Normal desktop terminals should not need this adjustment.

## Panda assets

Original assets are stored in `src/renderer/src/assets/`:

- `panda-sleep-natural-1536x1872.png`: resting-state animation, supplied as an 80-frame animated PNG (APNG).
- `default-panda.png`: static resting image.

The animated image plays natively in the browser. Reduced motion uses the static image, which also serves as the animation load-error fallback. CSS crops the original transparent margins without changing the source assets.

## Companion controls

- Drag the panda's body to move it. The panda is displayed at 75% of its original companion size.
- Hover over the panda to expand its controls. Moving onto the bar keeps it open. After leaving both the panda and bar, it stays open for one second, then contracts smoothly. Re-entering cancels the pending collapse. Keyboard focus also opens the bar; reduced motion disables the transition.
- The settings gear opens a separate panel next to the pet. It chooses the side with available space, stays within the display work area, and follows the pet when dragged. The timer button slides the bar open to reveal or hide the countdown. During a break, the bar stays open and shows the remaining break time in that same slot. Both icons have a mint-green circular hover highlight.
- The bar sits close beneath the panda when collapsed, with a little more space when expanded. Both resting images share the same baseline.
- On macOS, Cmd+Q or the app's Dock menu quits the app. There is no floating close button. If the pet is hidden, clicking the Dock icon opens Settings so it can be shown again.
- The window starts near the bottom-right of the primary display's available work area. It stays above other apps and follows macOS Spaces, including fullscreen spaces.

Window transparency and native drag regions follow [Electron's window styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles) and [custom interaction guidance](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions).

Since native drag regions suppress DOM pointer events, the main process samples cursor position every 75 milliseconds for hover detection. Only window-relative coordinates inside the companion, or a leave notification, cross the preload boundary. The sampler stops when the window closes and does not store cursor data.

## Settings panel

`src/renderer/src/components/Settings.tsx` contains the settings interface; its styling is in `globals.css`. The panel is a separate sandboxed Electron window using the same renderer entry point with `#settings`.

- Save validates and persists reminder preferences through electron-store. Cancel, the panel's X, and Escape close it without saving draft edits.
- Reset restores draft defaults; Save commits them.
- The saved reminder interval and **Enable breaks** preference control the next-break countdown. Changing either starts a fresh interval; saving unrelated settings preserves the current deadline. Enable breaks is below Sound notifications in General.
- **Show Pet** is applied only on Save and persists across relaunches. Cancel discards the draft visibility change. Settings remains accessible from the Dock when the pet is hidden. Launch at login and sound notifications remain disabled; no OS startup setting is changed.
- Saved preferences are read when the panel opens. The settings store is created lazily and does not run in the renderer.

## Next-break countdown

The main process creates one deadline per app session in `src/main/scheduler.ts`. The renderer calculates the remaining time from that timestamp, so delayed ticks, hiding the bar, and renderer reloads do not reset it. The countdown mode stays selected until the timer is clicked again; the normal one-second hover-collapse behavior still applies.

Disabled breaks show **Paused**. When the deadline arrives, a break starts for the saved duration. Finishing a scheduled break starts a fresh reminder interval. Relaunching the app begins a new session interval.

## Start break now

The break-duration slider defaults to **90 seconds**, ranges from **15 seconds to 5 minutes**, and moves in 15-second steps. Settings are stored in seconds. Existing version-1 preferences migrate to version 2, preserving other choices and initializing the new duration slider to 90 seconds.

**Start break now**, above Show Pet in Settings, begins a real break using the current draft duration, even before Save and even when Enable breaks is off. It does not save draft preferences. Repeated starts reuse an active break. After a break ends or is ended with Escape, the next reminder starts a fresh interval if breaks are enabled; otherwise it remains paused. Settings stays hidden afterward. Open it explicitly to return to its preserved draft.

## Break presentation

Each connected display receives a transparent, frameless dimming window covering its full bounds, including menu-bar and Dock areas. The black layer is **60% transparent (40% opacity)** and contains no text, countdown, or close buttons. These windows intercept mouse input, and the layer on the cursor's display takes keyboard focus at the start of the break. Typing and clicking no longer reach the applications underneath while the break window has focus. Panda dragging and navigation actions are paused until the break ends.

The panda stays above the dimming layer. Its navigation bar is pinned open and displays the remaining break countdown in the existing timer slot. Settings is unavailable during a break. The panda appears temporarily even if Show Pet is off; its saved visibility is restored when the break ends.

The main process advances the break lifecycle every 250 ms using wall-clock deadlines, so the UI cannot delay completion. Layers clear automatically when the duration ends, restoring normal input and panda dragging. Escape while a break or companion window has keyboard focus ends the current break without an on-screen button. Cmd+Q still quits the app. Display changes refresh the layers without adding duplicate dimming windows.

This is an input-blocking break overlay, not a macOS session lock or a pause of other processes. Applications and videos continue running underneath, and system shortcuts such as Cmd+Tab remain available. No Accessibility or Screen Recording permission is needed.
