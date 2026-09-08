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
    /// A bare process name is the ambiguity the path settles — every copy shares the name — so
    /// what is recorded has to be a path that resolves, and `arguments[0]` is the one
    /// `ps -o comm=` reports for the same process.
    @Test func `the probe records a resolvable path, not a process name`() {
        let path = FrameProbe.executablePath
        #expect(path.hasPrefix("/"))
        #expect(FileManager.default.isExecutableFile(atPath: path))
        #expect(URL(fileURLWithPath: path).lastPathComponent != path)
    }
}
