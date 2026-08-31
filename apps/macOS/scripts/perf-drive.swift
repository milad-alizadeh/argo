// Drives a running Argo with synthetic input, so a frame-rate number is taken against a repeatable
// interaction rather than a hand on a trackpad. The in-app probe (ARGO_FRAME_PROBE=1) measures;
// this only acts, and prints one machine-readable line per act:
//
//   perf-drive event=<name> at=<unix seconds> [key=value ...]
//
// `at` is on the same clock the probe stamps every frame with, which is the whole join: a click's
// `at` and the frame stamps after it are what click-to-settled latency is computed from.
//
//   sh perf-drive.sh nodes                     # dump the AX tree
//   sh perf-drive.sh rows                      # roster rows, by their real titles
//   sh perf-drive.sh watch                     # what a settle sees, poll by poll
//   sh perf-drive.sh scroll <profile> <secs>   # steady | aggressive | fling
//   sh perf-drive.sh room <Sessions|Tickets|Code>
//   sh perf-drive.sh scenario <name>           # scroll-long | roster-switch | room-switch
//
// Two scripts and a wrapper rather than one file, because SwiftLint's file ceiling is the house
// ceiling here too, and a `swift` shebang cannot see a sibling file. `perf-drive.sh` compiles both.
//
// A script rather than a target: nothing that ships in the app may synthesise input events.
//
// Posting CGEvents needs Accessibility permission for whichever terminal runs this. Without it the
// events are dropped silently — the window simply will not move, which is the one failure this
// cannot self-report. It also OWNS the pointer for its whole length.

import AppKit
import CoreGraphics
import Foundation

@main
enum PerfDrive {
    static func fail(_ message: String) -> Never {
        FileHandle.standardError.write(Data("perf-drive: \(message)\n".utf8))
        exit(1)
    }

    static func emit(_ event: String, _ detail: String = "") {
        let stamp = String(format: "%.6f", Date().timeIntervalSince1970)
        print("perf-drive event=\(event) at=\(stamp)\(detail.isEmpty ? "" : " " + detail)")
        fflush(stdout)
    }

    /// Settled = the surface has changed since the click and then held still for `hold` polls.
    ///
    /// A shorter hold calls the gap between two arriving panes "settled"; a longer one charges the
    /// switch for whatever the next interaction starts. Reported alongside the frame-cadence
    /// figure, which answers a different question — did the main thread stall — and usually no.
    static func settle(_ cockpit: Cockpit, from before: String, since click: Double) -> Int? {
        let hold = 3
        var previous = before
        var stable = 0
        var changed = false
        let deadline = Date().addingTimeInterval(120)
        while Date() < deadline {
            Thread.sleep(forTimeInterval: 0.1)
            let signature = cockpit.signature
            if signature == previous {
                stable += 1
            } else {
                stable = 0
                changed = true
                previous = signature
            }
            if changed, stable >= hold {
                let held = Double(hold) * 100
                return Int((Date().timeIntervalSince1970 - click) * 1000 - held)
            }
        }
        return nil
    }

    /// The unit both switch scenarios are made of: click a thing, then wait for the surface to
    /// stop.
    static func clickAndSettle(_ cockpit: Cockpit, _ node: Node, _ label: String) {
        let before = cockpit.signature
        let at = Date().timeIntervalSince1970
        click(node.centre, label)
        let short = label.prefix(48)
        guard let elapsed = settle(cockpit, from: before, since: at) else {
            emit("unsettled", "target=\"\(short)\"")
            return
        }
        emit("settled", "after_ms=\(elapsed) target=\"\(short)\"")
    }

    /// Which rows a scenario acts on, by their real titles.
    ///
    /// Named rather than indexed, because the roster is LIVE: another agent starting a session
    /// while this runs pushes a new row to the top, and an index would then measure what arrived.
    /// Polled, because the roster is read off disk — a staged transcript of tens of megabytes is
    /// parsed after the window is already up, and its row arrives seconds later.
    static func namedRow(_ cockpit: Cockpit, _ variable: String, fallback: Int) -> Node {
        guard let wanted = ProcessInfo.processInfo.environment[variable], !wanted.isEmpty else {
            let rows = cockpit.rosterRows
            guard rows.count > fallback else { fail("the roster has no row \(fallback)") }
            return rows[fallback]
        }
        let deadline = Date().addingTimeInterval(120)
        while Date() < deadline {
            let rows = cockpit.rosterRows
            if let row = rows.first(where: { $0.label.localizedCaseInsensitiveContains(wanted) }) {
                return row
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        fail("no roster row matching \(variable)=\"\(wanted)\" — `rows` lists what there is")
    }

    /// Opens a row and waits for the reading to land, so what follows measures the interaction
    /// rather than the tail of the mount before it.
    static func open(_ cockpit: Cockpit, _ row: Node) {
        clickAndSettle(cockpit, row, row.label)
        Thread.sleep(forTimeInterval: 5)
    }

    static func scenario(_ cockpit: Cockpit, _ name: String) {
        switch name {
        case "scroll-long":
            // The scroll needs a reading under it: an unselected cockpit has nothing to scroll,
            // and a measurement of that is a measurement of an idle display link.
            open(cockpit, namedRow(cockpit, "ARGO_PERF_ROW", fallback: 0))
            for profile in ["steady", "aggressive", "fling"] {
                scroll(cockpit, profile: profile, seconds: profile == "steady" ? 6 : 8)
            }
        case "roster-switch":
            // A -> B -> A -> B -> A. The second visit to A is the number that matters: nothing is
            // cached between sessions, so a re-click pays the whole mount again.
            let first = namedRow(cockpit, "ARGO_PERF_ROW", fallback: 0)
            let second = namedRow(cockpit, "ARGO_PERF_ROW_B", fallback: 1)
            for step in [first, second, first, second, first] {
                clickAndSettle(cockpit, step, step.label)
                Thread.sleep(forTimeInterval: 1.5)
            }
        case "room-switch":
            // A reading has to be up first, or a room switch costs nothing to come back to.
            open(cockpit, namedRow(cockpit, "ARGO_PERF_ROW", fallback: 0))
            for room in ["Tickets", "Sessions", "Tickets", "Sessions", "Code", "Sessions"] {
                guard let segment = cockpit.roomSegment(named: room) else {
                    fail("no room segment named \(room)")
                }
                clickAndSettle(cockpit, segment, "room:\(room)")
                Thread.sleep(forTimeInterval: 1.5)
            }
        default:
            fail("unknown scenario \(name)")
        }
        Thread.sleep(forTimeInterval: 1)
    }

    static func dump(_ cockpit: Cockpit) {
        for node in cockpit.nodes {
            let box = "\(Int(node.rect.minX)),\(Int(node.rect.minY)) " +
                "\(Int(node.rect.width))x\(Int(node.rect.height))"
            print("\(String(repeating: " ", count: node.depth))\(node.role) [\(box)] \(node.label)")
        }
    }

    /// Debug aid: what a settle sees, poll by poll, when one will not converge.
    static func watch(_ cockpit: Cockpit) {
        var last: [String] = []
        for _ in 0 ..< 20 {
            Thread.sleep(forTimeInterval: 0.3)
            let now = cockpit.deckShape
            let added = Set(now).subtracting(last).sorted().prefix(4)
            let gone = Set(last).subtracting(now).sorted().prefix(4)
            print("count=\(now.count) +\(added) -\(gone)")
            last = now
        }
    }

    static func main() {
        guard let cockpit = Cockpit.resolve() else {
            fail("no AX window for Argo — is it up, and is Accessibility granted to this shell?")
        }
        let arguments = Array(CommandLine.arguments.dropFirst())
        let second = arguments.count > 1 ? arguments[1] : ""
        switch arguments.first ?? "nodes" {
        case "nodes": dump(cockpit)
        case "watch": watch(cockpit)
        case "rows":
            for (index, row) in cockpit.rosterRows.enumerated() {
                print("row \(index) y=\(Int(row.rect.midY)) h=\(Int(row.rect.height)) \(row.label)")
            }
        case "scroll":
            let seconds = Double(arguments.count > 2 ? arguments[2] : "") ?? 8
            scroll(cockpit, profile: second.isEmpty ? "steady" : second, seconds: seconds)
        case "row":
            let row = cockpit.rosterRows
                .first { $0.label.localizedCaseInsensitiveContains(second) }
            guard let row else { fail("no roster row matching \"\(second)\"") }
            clickAndSettle(cockpit, row, row.label)
        case "room":
            guard let segment = cockpit.roomSegment(named: second.isEmpty ? "Sessions" : second)
            else {
                fail("no room segment named \(second)")
            }
            clickAndSettle(cockpit, segment, "room:\(second)")
        case "scenario": scenario(cockpit, second.isEmpty ? "scroll-long" : second)
        default: fail("unknown command \(arguments[0])")
        }
    }
}
