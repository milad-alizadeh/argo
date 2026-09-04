import ArgoEngine
@testable import ArgoTerminal
import Foundation
import Testing

/// A diagnostic harness for "Argo hangs once a few agents run together": every PTY chunk from
/// every agent is delivered on the MAIN queue (`LocalProcess(dispatchQueue: .main)`), so the
/// thread that draws the cockpit is also the thread that drains N terminals.
///
/// It measures the main thread's own responsiveness — the longest gap between two consecutive
/// turns of a loop that does nothing but yield — with 0, 1 and N firehosing children.
///
/// It reports a reading rather than asserting one: the numbers move with the machine, so a
/// threshold here would fail on a loaded laptop and pass on an idle one. It also spawns eight
/// firehosing children and holds the main actor for fifteen seconds, so it is off unless it is
/// asked for — `ARGO_PTY_LOAD=1 swift test`, the shape the ARGO_LIVE_CLI suites next door use.
/// The switch has to live outside the suite: a `@Suite` argument that reads the suite's own
/// static is a circular reference to the macro.
enum PtyLoad {
    static let isEnabled = ProcessInfo.processInfo.environment["ARGO_PTY_LOAD"] == "1"
}

@Suite("PTY main-thread load", .enabled(if: PtyLoad.isEnabled))
@MainActor
struct PtyMainThreadLoadTests {
    @Test(.timeLimit(.minutes(2)))
    func `main-thread stall against the number of live PTYs`() async throws {
        var report: [String] = []
        for count in [0, 1, 2, 4, 8] {
            let reading = try await Self.stall(withChildren: count)
            report.append(
                "children=\(count) maxGap=\(Self.ms(reading.maxGap))ms "
                    + "p99=\(Self.ms(reading.p99))ms turns=\(reading.turns) "
                    + "bytes=\(reading.bytes)",
            )
        }
        print("PTY main-thread load\n" + report.joined(separator: "\n"))
    }

    private struct Reading {
        let maxGap: Duration
        let p99: Duration
        let turns: Int
        let bytes: Int
    }

    /// Hold the main actor in a yield loop for a fixed wall-clock window and record the gaps.
    /// A gap is time the main thread spent NOT coming back to us — which is what a frozen
    /// cockpit is.
    private static func stall(withChildren count: Int) async throws -> Reading {
        let host = SwiftTermProcessHost()
        var bytes = 0
        var processes: [AgentProcess] = []
        for _ in 0 ..< count {
            try processes.append(host.start(
                firehose(),
                events: AgentProcessEvents(onData: { bytes += $0.count }, onExit: { _ in }),
            ))
        }
        defer { for process in processes {
            process.terminate()
        } }

        // Let the children reach full rate before the window opens.
        try await Task.sleep(for: .milliseconds(500))

        var gaps: [Duration] = []
        let clock = ContinuousClock()
        let end = clock.now + .seconds(3)
        var last = clock.now
        while clock.now < end {
            await Task.yield()
            let now = clock.now
            gaps.append(now - last)
            last = now
        }
        let sorted = gaps.sorted()
        return Reading(
            maxGap: sorted.last ?? .zero,
            p99: sorted.isEmpty ? .zero : sorted[Int(Double(sorted.count - 1) * 0.99)],
            turns: gaps.count,
            bytes: bytes,
        )
    }

    /// A child that writes as fast as the PTY will take it — the worst case of an agent
    /// redrawing a TUI.
    private static func firehose() -> AgentLaunch {
        AgentLaunch(
            executablePath: "/bin/sh",
            cwd: "/tmp",
            arguments: ["-c", "yes argo-firehose-line-of-plausible-terminal-width-0123456789"],
        )
    }

    private static func ms(_ duration: Duration) -> String {
        String(
            format: "%.1f",
            Double(duration.components.attoseconds) / 1e15
                + Double(duration.components.seconds) * 1000,
        )
    }
}
