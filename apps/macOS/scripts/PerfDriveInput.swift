// The synthetic-input half of `perf-drive` — clicks and the three scroll cadences.
// See perf-drive.swift for what drives it.

import AppKit
import CoreGraphics
import Foundation

extension PerfDrive {
    static func click(_ point: CGPoint, _ label: String) {
        CGWarpMouseCursorPosition(point)
        Thread.sleep(forTimeInterval: 0.05)
        for type in [CGEventType.leftMouseDown, .leftMouseUp] {
            let event = CGEvent(
                mouseEventSource: nil,
                mouseType: type,
                mouseCursorPosition: point,
                mouseButton: .left,
            )
            event?.post(tap: .cghidEventTap)
            Thread.sleep(forTimeInterval: 0.02)
        }
        emit("click", "target=\"\(label)\" x=\(Int(point.x)) y=\(Int(point.y))")
    }

    static func post(scroll delta: Int32, at point: CGPoint) {
        let event = CGEvent(
            scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1,
            wheel1: delta, wheel2: 0, wheel3: 0,
        )
        event?.location = point
        event?.post(tap: .cghidEventTap)
    }

    /// Down for the first half and back up for the second, so rows already seen are measured too.
    static func sweep(_ point: CGPoint, ticksPerSecond: Double, pixels: Int32, seconds: Double) {
        let ticks = Int(seconds * ticksPerSecond)
        for tick in 0 ..< ticks {
            post(scroll: tick < ticks / 2 ? -pixels : pixels, at: point)
            Thread.sleep(forTimeInterval: 1 / ticksPerSecond)
        }
    }

    /// Bursts of a decaying delta, alternating direction, with a beat between them for the settle.
    static func fling(_ point: CGPoint, seconds: Double) {
        for burst in 0 ..< max(Int(seconds / 1.2), 1) {
            var delta = 900.0
            while delta > 4 {
                post(scroll: Int32(burst.isMultiple(of: 2) ? -delta : delta), at: point)
                delta *= 0.86
                Thread.sleep(forTimeInterval: 1.0 / 120)
            }
            Thread.sleep(forTimeInterval: 0.35)
        }
    }

    /// Three cadences, because the complaint is about speed and one cadence measures one speed.
    /// `steady` is twelve pixels a tick at the refresh rate; `aggressive` is ten times the pixels
    /// at twice the tick rate; `fling` is what a trackpad throw looks like — a burst that decays.
    static func scroll(_ cockpit: Cockpit, profile: String, seconds: Double) {
        let point = cockpit.feedPoint
        CGWarpMouseCursorPosition(point)
        emit("scroll-begin", "profile=\(profile) seconds=\(seconds)")
        switch profile {
        case "steady": sweep(point, ticksPerSecond: 60, pixels: 12, seconds: seconds)
        case "aggressive": sweep(point, ticksPerSecond: 120, pixels: 120, seconds: seconds)
        case "fling": fling(point, seconds: seconds)
        default: fail("unknown scroll profile \(profile) — steady, aggressive or fling")
        }
        emit("scroll-end", "profile=\(profile)")
        // Between profiles, so a cadence is measured from rest rather than from the last one's
        // tail.
        Thread.sleep(forTimeInterval: 4)
    }
}
