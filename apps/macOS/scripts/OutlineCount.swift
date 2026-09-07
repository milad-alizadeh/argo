#!/usr/bin/env swift
// Polls the roster outline's accessibility child count on a timer, and can press New Session on
// the same clock — the repro #1562 asks for before that observation can be worked.
//
// Usage: swift OutlineCount.swift <pid> [--seconds N] [--interval MS] [--presses N] [--gap S]
//   --seconds  how long to poll for (default 60, four presses at the ticket's cadence plus room)
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
// A poll rather than an `AXObserver`, because #1562 is an observation made BY a polling client
// (`System Events`) and only such a client can catch a tree between settled states.
//
// SwiftUI builds no accessibility tree at all with no client attached (#777), so this probe is
// itself what makes the tree exist. That is the honest shape of the measurement: it reads what an
// accessibility client sees, which is the only thing #1562 ever claimed.
//
// TWO LIMITS to hold when quoting a run. Against `crowdedSpawningRoster` a press publishes a row
// and starts no process, so it does not carry the layout cost a real spawn drags in (#1559) — a
// clean run there says the roster's own republish is innocent, not that the real toolbar is.
// And a run reports the readings it took: three of these polled at 25 ms saw plateaus lasting tens
// of seconds, so a short run can sit inside one and see nothing move.

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

let seconds = option("--seconds", 60)
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
var readings: [(elapsedMS: Int, count: Int?)] = []
var pressedAt: [Int] = []
var pressesLeft = presses
var nextPress = gap

print("outline-count: pid \(pid), \(Int(seconds))s at \(Int(intervalMS))ms, \(presses) presses")
print("ms\tcount")

while Date().timeIntervalSince(start) < seconds {
    let elapsed = Date().timeIntervalSince(start)
    if pressesLeft > 0, elapsed >= nextPress {
        guard let button = newSessionButton() else {
            // Never counted as a press that happened. A run that silently pressed nothing reports
            // a flat count and reads exactly like a spawn that disturbed nothing.
            fail("no New Session button under pid \(pid) — nothing was pressed")
        }
        AXUIElementPerformAction(button, kAXPressAction as CFString)
        pressedAt.append(Int(elapsed * 1000))
        pressesLeft -= 1
        nextPress += gap
    }
    // Resolved fresh each pass, so a rebuild that replaces the outline is read as the new tree
    // rather than as a dead handle.
    let count = rosterOutline().map { children($0).count }
    let elapsedMS = Int(Date().timeIntervalSince(start) * 1000)
    readings.append((elapsedMS, count))
    print("\(elapsedMS)\t\(count.map(String.init) ?? "no outline")")
    Thread.sleep(forTimeInterval: intervalMS / 1000)
}

let counts = readings.compactMap(\.count)
guard let low = counts.min(), let high = counts.max() else { fail("no readings") }
// The count the roster spent most of the run at. Reported, never judged against: see the verdict
// below for why the mode is the wrong thing to measure a run's spread by.
guard let commonest = Dictionary(grouping: counts, by: { $0 })
    .max(by: { $0.value.count < $1.value.count })
else { fail("no readings") }
let settled = commonest.key

/// Where the count changed, which is what a run is read for. Printed rather than a mean: the
/// readings arrive as plateaus lasting tens of seconds, and a mean describes none of them.
let steps = readings.indices.filter { $0 == 0 || readings[$0].count != readings[$0 - 1].count }

print("")
print("outline-count: \(readings.count) readings, low \(low), commonest \(settled), high \(high)")
print("outline-count: pressed at \(pressedAt.map(String.init).joined(separator: ", "))ms")
print("outline-count: plateaus")
for step in steps.prefix(40) {
    print(
        "  \(readings[step].elapsedMS)ms\t\(readings[step].count.map(String.init) ?? "no outline")",
    )
}

// Judged on the SPREAD of the run, not on distance from the commonest reading. A run that spends
// most of itself on the high plateau has that plateau as its mode, and a rule written against the
// mode would call the tree steady exactly when it is furthest from the roster. A drop counts for
// the same reason a spike does: both are the count disagreeing with itself about one roster.
if high >= low * 2 {
    print("outline-count: UNSTABLE — high \(high) is at least twice low \(low) in one run")
    exit(2)
}

print("outline-count: the count held within a factor of two across the run")
