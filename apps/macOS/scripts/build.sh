#!/bin/sh
# `xcodebuild` for the app target, wired into `bun run build` through turbo.
#
# The project signs automatically against a real Apple Development identity (#627), which the
# CI runners do not have and cannot be given — the build there fails on the certificate before
# it compiles a line. Signing is dropped when no codesigning identity is installed, so the CI
# job still checks what it is there to check: that the app target compiles.
#
# The condition is the certificate, not the runner, because a contributor without one is the
# same case. A machine that has an identity builds exactly as Xcode does.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

if security find-identity -p codesigning -v 2>/dev/null | grep -q "Apple Development"; then
  signing=""
else
  echo "build: no codesigning identity — building unsigned" >&2
  signing="CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= DEVELOPMENT_TEAM="
fi

# shellcheck disable=SC2086 # $signing is a deliberate argument list, empty when signing stays on.
exec xcodebuild -project Argo.xcodeproj -scheme Argo -configuration Debug \
  -derivedDataPath build build $signing
