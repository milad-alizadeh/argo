@testable import ArgoUI
import AtlasLayout
import AtlasView
import Foundation
import Testing

/// What a click on the map means (#1156). The whole descent turns on this: a folder is a place to
/// go, a file is a thing to read, and the ground puts a reading away — three answers a still
/// screenshot cannot tell apart and a pointer cannot be scripted into.
@Suite("Atlas — what a pick means")
@MainActor
struct AtlasPickRuleTests {
    @Test func `a folder is a place to go`() {
        #expect(
            AtlasPickRule
                .outcome(of: .folder("root/app"), standingIn: "root") == .enter("root/app"),
        )
    }

    /// The plate under the whole picture is the ground. Descending into the folder you are already
    /// in would re-tile nothing, so the click would read as one that did nothing at all — and this
    /// is the gesture #1154 counts as one of the three ways out of a reading.
    @Test func `the folder you are standing in is the ground`() {
        #expect(AtlasPickRule.outcome(of: .folder("root/app"), standingIn: "root/app") == .close)
        #expect(AtlasPickRule.outcome(of: .folder("root"), standingIn: "root") == .close)
    }

    @Test func `a file is a thing to read, and the ground puts the reading away`() {
        #expect(AtlasPickRule.outcome(of: .file("root/a.swift"), standingIn: "root") == .read(
            "root/a.swift",
        ))
        #expect(AtlasPickRule.outcome(of: nil, standingIn: "root") == .close)
    }

    /// A reading is of a file, and a file the map no longer draws is a reading of nothing — the
    /// rule the descent closes an open file by.
    @Test func `a file off the map is not still open`() {
        let map = Self.map()

        #expect(AtlasPickRule.stays("root/app/main.swift", on: map))
        #expect(!AtlasPickRule.stays("root/docs/guide.md", on: map))
        #expect(!AtlasPickRule.stays(nil, on: map))
    }

    /// The other half of where a reader is: the trail says it, and the control back up is derived
    /// from the trail rather than held beside it, so the two cannot disagree.
    @Test func `the way up is the step before the one you are on`() {
        let steps = [
            AtlasStep(path: "root", name: "root"),
            AtlasStep(path: "root/app", name: "app"),
        ]

        #expect(AtlasDescent(trail: steps) { _ in }.up == "root")
        #expect(AtlasDescent(trail: [steps[0]]) { _ in }.up == nil)
    }

    /// One folder holding one file, which is all any claim here needs: what is ON the map, and what
    /// is not.
    private static func map() -> AtlasMap {
        AtlasMap(
            measuredAt: Date(),
            commit: nil,
            root: AtlasPlate(path: "root/app", children: [
                .plot(AtlasPlot(path: "root/app/main.swift", measures: ["lines": 1])),
            ]),
        )
    }
}
