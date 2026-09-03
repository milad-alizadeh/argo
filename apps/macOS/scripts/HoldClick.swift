#!/usr/bin/env swift
// Presses the mouse on one point of a running Argo's window, captures the window while the button
// is still DOWN, lets go, and captures it again — the one state a still specimen has no name for.
//
// Usage: swift HoldClick.swift <pid> <x> <y> <out-prefix>
//   x, y are points from the window's top-left corner. Writes <out-prefix>-held.png and
//   <out-prefix>-released.png.
//
// IT TAKES THE MOUSE: the events go through the HID tap, so the pointer moves and the press is
// real. Say so and wait before running it, as with an e2e run. An event posted to the pid alone
// reaches neither the table nor the row's tap gesture, measured, so there is no quieter route.
//
// A scripted press of 0.6s never drew the platform's own selection fill on a roster row, where a
// hand on the mouse draws it within a second (#1137). So this proves what the fix draws under a
// hold, and the frame of the defect itself is a human's
// (`docs/designs/renders/1137-pressed-row.png`).
//
// The window is found by `WindowID.swift` beside this file, and captured by id as `screenshot.sh`
// does, which needs the same Screen Recording permission.

import AppKit
import CoreGraphics
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("hold-click: \(message)\n".utf8))
    exit(1)
}

guard CommandLine.arguments.count == 5,
      let pid = pid_t(CommandLine.arguments[1]),
      let x = Double(CommandLine.arguments[2]),
      let y = Double(CommandLine.arguments[3])
else {
    fail("usage: HoldClick.swift <pid> <x> <y> <out-prefix>")
}

let prefix = CommandLine.arguments[4]

/// Runs a tool to completion and answers with its stdout, or fails naming it.
func run(_ executable: String, _ arguments: [String]) -> String {
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = output
    do {
        try process.run()
    } catch {
        fail("cannot run \(executable): \(error)")
    }
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
        fail(
            "\(executable) \(arguments.joined(separator: " ")) exited \(process.terminationStatus)",
        )
    }
    let bytes = output.fileHandleForReading.readDataToEndOfFile()
    guard let text = String(bytes: bytes, encoding: .utf8) else {
        fail("\(executable) answered something that is not UTF-8")
    }
    return text
}

let scriptsDirectory = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
let windowID = scriptsDirectory.appendingPathComponent("WindowID.swift").path
let fields = run("/usr/bin/swift", [windowID, String(pid), "--bounds"]).split(separator: " ")
guard fields.count == 5,
      let windowNumber = Int(fields[0]),
      let originX = Double(fields[1]),
      let originY = Double(fields[2])
else {
    fail("WindowID.swift --bounds answered \(fields.joined(separator: " "))")
}

/// Global display coordinates share the window list's top-left origin, so the offset adds directly.
let point = CGPoint(x: originX + x, y: originY + y)

func post(_ type: CGEventType) {
    guard let event = CGEvent(
        mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left,
    ) else { fail("cannot make a \(type) event") }
    event.setIntegerValueField(.mouseEventClickState, value: 1)
    event.post(tap: .cghidEventTap)
}

func capture(_ name: String) {
    let file = "\(prefix)-\(name).png"
    _ = run("/usr/sbin/screencapture", ["-o", "-x", "-l\(windowNumber)", file])
    print("hold-click: \(file)")
}

// Frontmost, because the platform draws an emphasised selection only in the key window of the
// active app.
NSRunningApplication(processIdentifier: pid)?.activate()
Thread.sleep(forTimeInterval: 0.5)

// Warped rather than moved by event: a press lands only where the pointer already is.
CGWarpMouseCursorPosition(point)
Thread.sleep(forTimeInterval: 0.1)
post(.leftMouseDown)
Thread.sleep(forTimeInterval: 0.6)
capture("held")
post(.leftMouseUp)
Thread.sleep(forTimeInterval: 0.6)
capture("released")
