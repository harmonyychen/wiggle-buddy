#!/bin/sh
set -eu

: "${APPLE_KEYCHAIN_PROFILE:?Set APPLE_KEYCHAIN_PROFILE to your notarytool Keychain profile.}"
dmg="dist/${npm_package_name}-${npm_package_version}-arm64.dmg"

npm run build
electron-builder --mac dmg --arm64 --publish never
codesign --verify --strict -R='anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists' "$dmg"
xcrun notarytool submit "$dmg" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait
xcrun stapler staple "$dmg"
xcrun stapler validate "$dmg"
spctl --assess --type open --context context:primary-signature --verbose "$dmg"
