import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// The committed written layer, read beside the committed measurement (#1159). The claims here are
/// about the two files TOGETHER: that they join on the path, and that the map does not know the
/// second one exists.
@Suite("Atlas — the written layer beside the map")
struct AtlasWrittenLayerTests {
    @Test func `a note joins the map on the path the whole Atlas runs on`() throws {
        // The join key, checked against a real measurement rather than a hand-written pair: a
        // written layer keyed on anything else says nothing about any file the map draws.
        let map = try AtlasMapFixture.argo()
        let notes = try AtlasNotesFixture.argo()

        let noted = notes.files.keys.filter { path in map.plots.contains { $0.path == path } }
        #expect(noted.count == notes.files.count)
    }

    @Test func `the map is measured with no reference to what was written about it`() throws {
        // The ticket's second criterion, made structural: the Map read from its own file carries
        // no Note, no flag and no sentence, so a repository with no written layer beside it draws
        // exactly this map. Nothing here can be broken by a change to the written layer, because
        // there is no path from one to the other.
        let map = try AtlasMapFixture.argo()
        let notes = try AtlasNotesFixture.argo()

        #expect(!notes.isEmpty)
        for plot in map.plots {
            #expect(plot.measures.keys.allSatisfy { $0 != "note" })
        }
        #expect(map.measureNames == ["age_in_weeks", "authors", "bytes", "commits", "lines"])
    }

    @Test func `the committed layer carries a note, a caption and a subject to check`() throws {
        // The fixture is the input to the panel's own renders, so what it holds is a claim worth
        // asserting: a note about a file, a caption about a folder, and at least one subject a
        // check can actually run against.
        let notes = try AtlasNotesFixture.argo()

        let panel = "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Evidence/" +
            "EvidencePanel.swift"
        let note = try #require(notes.note(ofFile: panel))
        #expect(!note.words.isEmpty)
        #expect(!note.flag.isEmpty)
        #expect(note.standing == .unchecked)
        #expect(notes.note(ofFolder: "argo/rules") != nil)
        #expect(notes.subjects.contains(panel))
    }
}
