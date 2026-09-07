#!/usr/bin/env swift
// Polls the roster outline's accessibility child count on a timer, and can press New Session on
// the same clock — the repro #1562 asks for before that observation can be worked.
//
// Usage: swift OutlineCount.swift <pid> [--seconds N] [--interval MS] [--presses N] [--gap S]
//   --seconds  how long to poll for (default 30)
//   --interval how often, in milliseconds (default 25)
//   --presses  how many times to press New Session during the run (default 0, poll only)
//   --gap      seconds between presses (default 12, the ticket's cadence)
//
// It takes NEITHER the pointer NOR the keyboard: the count is read through
// `AXUIElementCopyAttributeValue` and the press is `kAXPressAction`, both addressed to the pid.
// So it is safe to run while somebody is using the machine, unlike `HoldClick.swift` or an e2e
// run. It needs Accessibility permission for the terminal running it, the same gate every AX walk
// here is behind.
//
// Why a poll rather than an observer: #1562 is an observation made BY a polling client
// (`System Events`), and the claim is that such a client can see the tree mid-rebuild. An
// `AXObserver` would be told about the settled tree and could never see that, so it would answer a
// question nobody asked.
//
// SwiftUI builds no accessibility tree at all with no client attached (#777), so this probe is
// itself what makes the tree exist. That is the honest shape of the measurement: it reads what an
// accessibility client sees, which is the only thing #1562 ever claimed.

import ApplicationServices
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("outline-count: \(message)\n".utf8))
    exit(1)
}

var arguments = CommandLine.arguments.dropFirst()
guard let first = arguments.first, let pid = pid_t(first) else {
    fail("usage: OutlineCount.swift <pid> [--seconds N] [--interval MS] [--presses N] [--gap S]")
}

arguments = arguments.dropFirst()

/// Reads one `--flag value` pair, or answers the fallback. Fails on a flag with nothing after it,
/// because a run that silently used the default would be reported as if it had used the value.
func option(_ name: String, _ fallback: Double) -> Double {
    guard let flag = arguments.firstIndex(of: name) else { return fallback }
    let value = arguments.index(after: flag)
    guard value < arguments.endIndex, let number = Double(arguments[value]) else {
        fail("\(name) needs a number after it")
    }
    return number
}

let seconds = option("--seconds", 30)
let intervalMS = option("--interval", 25)
let presses = Int(option("--presses", 0))
let gap = option("--gap", 12)

let application = AXUIElementCreateApplication(pid)

/// One attribute off one element, or nil. Every AX read here goes through this: the API answers an
/// error code and an out-parameter, and a walk written against it directly reads as noise.
func attribute<Value>(_ element: AXUIElement, _ name: String, as _: Value.Type) -> Value? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else {
        return nil
    }
    return value as? Value
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute, as: [AXUIElement].self) ?? []
}

func role(_ element: AXUIElement) -> String {
    attribute(element, kAXRoleAttribute, as: String.self) ?? ""
}

/// Every element under `element`, breadth-first, to `depth`. Breadth-first because the outline sits
/// near the top of the window's tree and a depth-first walk would descend a hundred rows first.
func descendants(of element: AXUIElement, depth: Int) -> [AXUIElement] {
    var found: [AXUIElement] = []
    var frontier = [element]
    for _ in 0 ..< depth {
        let next = frontier.flatMap(children)
        found += next
        frontier = next
    }
    return found
}

/// The roster's outline: the outline with the most children in the window. Argo draws one
/// `List` in the sidebar and one deck beside it, and picking by size rather than by position
/// survives the sidebar moving. Re-resolved on every miss, never cached across the run, because a
/// tree being rebuilt is exactly the claim under test and a stale handle would answer zero.
func rosterOutline() -> AXUIElement? {
    descendants(of: application, depth: 8)
        .filter { role($0) == kAXOutlineRole }
        .max { children($0).count < children($1).count }
}

/// The New Session button, by the label `NewSessionOffer` publishes.
func newSessionButton() -> AXUIElement? {
    descendants(of: application, depth: 8).first {
        role($0) == kAXButtonRole
            && attribute($0, kAXDescriptionAttribute, as: String.self) == "New Session"
    }
}

guard AXIsProcessTrusted() else {
    fail("no Accessibility permission for this terminal — grant it in System Settings › Privacy")
}

guard rosterOutline() != nil else {
    fail("no outline under pid \(pid): is that Argo, and is its window up?")
}

let start = Date()
var readings: [(elapsedMS: Int, count: Int)] = []
var pressedAt: [Int] = []
var pressesLeft = presses
var nextPress = gap

print("outline-count: pid \(pid), \(Int(seconds))s at \(Int(intervalMS))ms, \(presses) presses")
print("ms\tcount")

while Date().timeIntervalSince(start) < seconds {
    let elapsed = Date().timeIntervalSince(start)
    if pressesLeft > 0, elapsed >= nextPress {
        if let button = newSessionButton() {
            AXUIElementPerformAction(button, kAXPressAction as CFString)
            pressedAt.append(Int(elapsed * 1000))
        }
        pressesLeft -= 1
        nextPress += gap
    }
    // Resolved fresh each pass, so a rebuild that replaces the outline is read as the new tree
    // rather than as a dead handle.
    let count = rosterOutline().map { children($0).count } ?? -1
    let elapsedMS = Int(Date().timeIntervalSince(start) * 1000)
    readings.append((elapsedMS, count))
    print("\(elapsedMS)\t\(count)")
    Thread.sleep(forTimeInterval: intervalMS / 1000)
}

let counts = readings.map(\.count).filter { $0 >= 0 }
guard let low = counts.min(), let high = counts.max() else { fail("no readings") }
// The count the roster spends its run at: the most common reading, not the mean, because a
// spike's whole claim is that it is far from the settled value.
guard let commonest = Dictionary(grouping: counts, by: { $0 })
    .max(by: { $0.value.count < $1.value.count })
else { fail("no readings") }
let settled = commonest.key

print("")
print("outline-count: \(readings.count) readings, low \(low), settled \(settled), high \(high)")
print("outline-count: pressed at \(pressedAt.map(String.init).joined(separator: ", "))ms")
if counts.contains(where: { $0 >= settled * 2 }) {
    let spikes = readings.filter { $0.count >= settled * 2 }
    print("outline-count: SPIKE — \(spikes.count) readings at or over twice the settled count")
    for spike in spikes.prefix(20) {
        print("  \(spike.elapsedMS)ms\t\(spike.count)")
    }
    exit(2)
}

print("outline-count: no reading reached twice the settled count")
