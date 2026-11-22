# wigglebuddy

wiggle buddy is a macOS desktop companion that reminds you to get up and stretch, and stretches with you! The panda rests above other applications in a frameless, draggable window.

## Stack

Electron, React, TypeScript, electron-vite, Tailwind CSS, electron-store, Lucide React.

## Develop

Run `npm ci` and then `npm run dev`. The Electron main process owns the windows, break schedule, and saved preferences. The sandboxed preload exposes those controls to the React renderer, which draws the panda and settings panel.

## For Apple Silicon running macOS 13 or later:

Run `npm run dist:mac` 
Open the DMG, drag **wigglebuddy** to **Applications**, and launch it

## Features and How to Use
Customize the duration of your breaks and work intervals through the settings. 
Click **Quit** beside the break countdown or press **Esc** to end the current break early.
