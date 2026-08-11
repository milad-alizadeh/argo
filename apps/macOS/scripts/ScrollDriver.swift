#!/usr/bin/env swift
// Scrolls a running Argo's feed at a fixed cadence, so a frame-rate number is taken against a
// repeatable input rather than a hand on a trackpad.
//
// A script rather than a target: nothing that ships in the app may synthesise input events.
//
//   swift ScrollDriver.swift [app] [seconds] [ticksPerSecond] [pixelsPerTick]
//
// Posting CGEvents needs Accessibility permission for whichever terminal runs this. Without it the
// events are dropped silently — the window simply will not move, which is the one failure this
// cannot self-report.

import AppKit
import CoreGraphics
import Foundation

let arguments = CommandLine.arguments
let appName = arguments.count > 1 ? arguments[1] : "Argo"
let bundleID = "dev.milad.argo"
let seconds = Double(arguments.count > 2 ? arguments[2] : "") ?? 8
let ticksPerSecond = Double(arguments.count > 3 ? arguments[3] : "") ?? 60
let pixelsPerTick = Int32(arguments.count > 4 ? arguments[4] : "") ?? 12

// Raised before anything is aimed at it. A scroll event goes to whatever window is UNDER the
// pointer, not to the window whose coordinates placed it — so a target behind the launching
// terminal gets nothing and the terminal gets the scroll, which looks exactly like a measurement.
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first
    ?? NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == appName })
else {
    FileHandle.standardError.write(Data("scroll-driver: \(appName) is not running\n".utf8))
    exit(1)
}

app.activate(options: [])
Thread.sleep(forTimeInterval: 0.6)

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]],
      let match = windows.first(where: { window in
          window[kCGWindowOwnerName as String] as? String == appName
              && window[kCGWindowLayer as String] as? Int == 0
      }),
      let bounds = match[kCGWindowBounds as String] as? [String: Any],
      let x = bounds["X"] as? Double,
      let y = bounds["Y"] as? Double,
      let width = bounds["Width"] as? Double,
      let height = bounds["Height"] as? Double
else {
    FileHandle.standardError
        .write(Data("scroll-driver: no on-screen window owned by \(appName)\n".utf8))
    exit(1)
}

/// Aimed at the feed, not the window's middle: a little past halfway across is inside the reading
/// at every allowed width.
let target = CGPoint(x: x + width * 0.55, y: y + height * 0.55)

/// Activating an app is not the same as clearing the point: a panel or an unraised window can still
/// be over the target pixel and would take the events silently. The list is front-to-back, so the
/// first layer-0 window containing the point is the one that gets them.
let frontmostAtTarget = windows.first { window in
    guard window[kCGWindowLayer as String] as? Int == 0,
          let frame = window[kCGWindowBounds as String] as? [String: Any],
          let left = frame["X"] as? Double,
          let top = frame["Y"] as? Double,
          let across = frame["Width"] as? Double,
          let down = frame["Height"] as? Double
    else {
        return false
    }
    return (left ... left + across).contains(target.x)
        && (top ... top + down).contains(target.y)
}

let owner = frontmostAtTarget?[kCGWindowOwnerName as String] as? String
guard owner == appName else {
    FileHandle.standardError.write(Data("""
    scroll-driver: \(owner ?? "another window") is in front of \(appName) at \
    \(Int(target.x)),\(Int(target.y)) — it would have taken the scroll. Nothing was posted.\n
    """.utf8))
    exit(1)
}

CGWarpMouseCursorPosition(target)

/// Down for the first half and back up for the second, so rows already seen are measured too.
let ticks = Int(seconds * ticksPerSecond)
let interval = 1 / ticksPerSecond

for tick in 0 ..< ticks {
    let delta = tick < ticks / 2 ? -pixelsPerTick : pixelsPerTick
    let event = CGEvent(
        scrollWheelEvent2Source: nil,
        units: .pixel,
        wheelCount: 1,
        wheel1: delta,
        wheel2: 0,
        wheel3: 0,
    )
    event?.location = target
    event?.post(tap: .cghidEventTap)
    Thread.sleep(forTimeInterval: interval)
}

print("scroll-driver: \(ticks) ticks over \(seconds)s at \(Int(target.x)),\(Int(target.y))")
