#!/bin/sh
set -eu

if [ "$(uname -s)" != Darwin ] || [ "$(/usr/sbin/sysctl -in hw.optional.arm64)" != 1 ]; then
  echo "wigglebuddy requires a Mac with an Apple M-series chip." >&2
  exit 1
fi
mac_version=$(sw_vers -productVersion)
if [ "${mac_version%%.*}" -lt 13 ]; then
  echo "wigglebuddy requires macOS 13 or later." >&2
  exit 1
fi

cd "$(dirname "$0")"
# Finder can start Terminal with a shorter PATH than an interactive shell.
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
if ! command -v npm >/dev/null || ! node -e '
  const [major, minor] = process.versions.node.split(".").map(Number)
  process.exit(major >= 24 || (major === 22 && minor >= 13) ? 0 : 1)
' 2>/dev/null; then
  echo "Install Node.js 24 or newer from https://nodejs.org/en/download, then open Install.command again." >&2
  exit 1
fi

echo "Preparing the wigglebuddy installer. This can take a few minutes…"
build_log=$(mktemp -t wigglebuddy-install)
if ! (npm ci && npm run dist:mac) >"$build_log" 2>&1; then
  echo "Couldn't build the installer. The build log is at $build_log" >&2
  exit 1
fi
rm -f "$build_log"

version=$(node -p 'require("./package.json").version')
echo "Drag wigglebuddy onto Applications in the window that opens."
open "dist/local/wigglebuddy-${version}-arm64.dmg"
