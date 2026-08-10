#!/usr/bin/env swift
// Scrolls a running Argo's feed at a fixed cadence, so "is scrolling smooth" can be asked of a
// repeatable input instead of a hand on a trackpad. A hand cannot scroll the same way twice, and a
// frame-rate number is only worth comparing against another one taken the same way.
//
// Run as a script rather than built into a target, for the same reason `WindowID.swift` is: nothing
// that ships in the app should be able to synthesise input events.
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

// Raised before anything is aimed at it, and this is the whole ballgame. A scroll event goes to
// whatever window is UNDER the pointer, not to the window whose coordinates were used to place it
// — so a target sitting behind the terminal that launched this receives nothing, and the terminal
// receives a scroll nobody asked for. That failure looks exactly like a measurement: the driver
// reports its ticks, the sampler reports an idle app, and the conclusion drawn is about the wrong
// window entirely.
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

/// Aimed at the feed rather than at the window's middle. The deck sits right of the sidebar and the
/// feed is the column left of the minimap, so a little past half way across is inside the reading
/// at every width the window allows.
let target = CGPoint(x: x + width * 0.55, y: y + height * 0.55)

/// Checked rather than assumed, because activating an app is not the same as clearing the point.
/// A panel, an overlay or a window the activation did not raise can still be over the pixel this
/// aims at, and the events would go there instead — silently, and reported as a completed run. The
/// list is front-to-back, so the first layer-0 window containing the point is the one that gets
/// them.
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

/// Down for the first half and back up for the second. A scroll that only ever ran one way would
/// measure the cost of realising rows and never the cost of coming back through rows already seen.
let ticks = Int(seconds * ticksPerSecond)
let interval = 1 / ticksPerSecond

/// A trackpad DRAG, not a wheel. The two are different inputs to the same scroll view: a wheel tick
/// is discrete and lands as a single change, while a drag is continuous and carries a phase, which
/// is what puts the scroll view into an interactive scroll and what `onScrollPhaseChange` answers
/// to. Measuring the wheel would be measuring the input nobody is complaining about.
///
/// The phase field has no name in `CGEventField`, so it is addressed by its raw value the way
/// every other tool that synthesises a trackpad scroll does.
let scrollPhase = CGEventField(rawValue: 99)

/// `began` on the first tick, `ended` on the last, `changed` for everything between — the shape of
/// one unbroken drag rather than a run of separate ones.
func phase(at tick: Int, of ticks: Int) -> Int64 {
    if tick == 0 {
        return 1
    }
    if tick == ticks - 1 {
        return 4
    }
    return 2
}

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
    event?.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
    if let scrollPhase {
        event?.setIntegerValueField(scrollPhase, value: phase(at: tick, of: ticks))
    }
    event?.location = target
    event?.post(tap: .cghidEventTap)
    Thread.sleep(forTimeInterval: interval)
}

print("scroll-driver: \(ticks) ticks over \(seconds)s at \(Int(target.x)),\(Int(target.y))")
