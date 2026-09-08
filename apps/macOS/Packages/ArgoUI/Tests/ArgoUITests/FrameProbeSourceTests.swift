@testable import ArgoUI
import Foundation
import Testing

/// A report has to name the build that wrote it. Every worktree builds its own `Release/Argo.app`
/// and they all carry the process name, so two reports of an A/B pair are identical in shape and
/// nothing in either says which produced it — the crossing #1566 exists to stop, and the one
/// `hang-sample.sh` already closed on the sampler side.
@Suite("Frame probe — a report names its own build")
struct FrameProbeSourceTests {
    /// What a reader picks the two facts out of: the keys, nested the way the file nests them,
    /// decoded rather than cast so the shape is the assertion.
    struct ReportFile: Codable {
        struct Source: Codable {
            var executablePath: String
            var displayMaxFPS: Int
        }

        var source: Source
        var frameBudgetMS: Double
    }

    static func reduced(from executablePath: String, displayMaxFPS: Int = 60) -> FrameProbeSummary {
        FrameProbeSummary(
            stamps: [100.0, 101.0],
            passes: [],
            passCosts: [],
            source: FrameProbeSummary.Source(
                executablePath: executablePath,
                displayMaxFPS: displayMaxFPS,
            ),
        )
    }

    @Test func `the summary carries the executable it was measured under`() {
        let path = "/one/worktree/Argo.app/Contents/MacOS/Argo"
        #expect(Self.reduced(from: path).source.executablePath == path)
    }

    /// The value is not what a measurement pair is compared from: the JSON file is. So the two
    /// runs are told apart by a key a reader can find, under `source`, in the written bytes.
    @Test func `the written report names the build under source`() throws {
        let one = "/tree-a/Argo.app/Contents/MacOS/Argo"
        let other = "/tree-b/Argo.app/Contents/MacOS/Argo"
        let written = try JSONEncoder().encode(Self.reduced(from: one))
        let crossed = try JSONEncoder().encode(Self.reduced(from: other))
        let read = try JSONDecoder().decode(ReportFile.self, from: written)
        #expect(read.source.executablePath == one)
        #expect(try JSONDecoder().decode(ReportFile.self, from: crossed)
            .source.executablePath == other)
    }

    /// A report that cannot name its build says so by carrying no key, rather than by carrying a
    /// key with nothing in it. An empty string would read as an answer to a reader diffing a pair.
    @Test func `a summary with no path to name omits the key rather than emptying it`() throws {
        let summary = FrameProbeSummary(
            stamps: [100.0, 101.0],
            passes: [],
            passCosts: [],
            source: FrameProbeSummary.Source(executablePath: nil, displayMaxFPS: 60),
        )
        let encoded = try JSONEncoder().encode(summary)
        let written = try #require(String(bytes: encoded, encoding: .utf8))
        #expect(written.contains("executablePath") == false)
        #expect(written.contains("displayMaxFPS"))
    }

    /// The ceiling moved into `source` and every figure is still stated against it, which is what
    /// the grouping had to leave untouched: 120 Hz is an 8.33ms budget, not 16.67.
    @Test func `the budget is still read off the ceiling now grouped under source`() throws {
        let summary = Self.reduced(from: "/tree/Argo", displayMaxFPS: 120)
        #expect(summary.frameBudgetMS == 1000.0 / 120.0)
        let read = try JSONDecoder().decode(ReportFile.self, from: JSONEncoder().encode(summary))
        #expect(read.source.displayMaxFPS == 120)
        #expect(read.frameBudgetMS == summary.frameBudgetMS)
    }
}

/// What the probe itself puts in that field, read on the actor it belongs to.
@Suite("Frame probe — the path it records")
@MainActor
struct FrameProbeExecutablePathTests {
    /// The claim the whole ticket rests on, and the only one worth asserting here: the string the
    /// probe records for a process is the string `ps -o comm=` reports for that same process.
    /// `hang-sample.sh` prints its target off `comm=` since #1560, so agreeing with `ps` IS
    /// agreeing with the sampler — and a shape check (absolute, resolves on disk) would instead
    /// assert a property of however this suite happened to be launched.
    @Test func `the path the probe records is the one ps reports for the same process`() throws {
        let reading = Process()
        reading.executableURL = URL(fileURLWithPath: "/bin/ps")
        reading.arguments = ["-o", "comm=", "-p", String(ProcessInfo.processInfo.processIdentifier)]
        let output = Pipe()
        reading.standardOutput = output
        try reading.run()
        let printed = output.fileHandleForReading.readDataToEndOfFile()
        reading.waitUntilExit()
        let reported = try #require(String(bytes: printed, encoding: .utf8))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        #expect(reported.isEmpty == false)
        #expect(FrameProbe.executablePath == reported)
    }
}
