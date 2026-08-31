@testable import ArgoEngine
import Testing

// A mutating call's patch, read THROUGH the reader — so the dispatch that decides an `edit` is read
// as a diff and the reading that turns the patch into hunks are exercised by one assertion. A wrong
// `FileChange` is only wrong where a row would show it, and that is here.

@Suite("Diff evidence")
struct DiffEvidenceTests {
    /// The patch one call produced, or a recorded failure naming what the row got instead.
    private func diff(_ id: String, readImage: @escaping ImageReader = noImageReader) async throws
        -> DiffEvidence? {
        let outcomes = try await Fixture.events("edits", readImage: readImage).outcomes()
        let result = try #require(outcomes[id]?.result)
        guard case let .diff(diff) = result else {
            Issue.record("\(id) was read as \(result), not as a patch")
            return nil
        }
        return diff
    }

    @Test
    func `A create reports the whole new file as added, from the content beside an empty patch`(
    ) async throws {
        let diff = try #require(try await diff("edit-create"))

        #expect(diff.tier == .direct)
        #expect(diff.change == .create)
        #expect(diff.added == 2)
        #expect(diff.removed == 0)
        #expect(diff.hunks == [DiffHunk(oldStart: 0, newStart: 1, lines: [
            DiffLine(side: .add, text: "export const a = 1"),
            DiffLine(side: .add, text: "export const b = 2"),
        ])])
    }

    @Test
    func `A modify keeps the host's line numbers and strips each marker onto its side`(
    ) async throws {
        let diff = try #require(try await diff("edit-modify"))

        #expect(diff.change == .modify)
        #expect(diff.added == 1)
        #expect(diff.removed == 1)
        #expect(diff.hunks == [DiffHunk(oldStart: 1, newStart: 1, lines: [
            DiffLine(side: .del, text: "import { a } from './helper'"),
            DiffLine(side: .add, text: "import { a, b } from './helper'"),
            DiffLine(side: .context, text: "export { a }"),
        ])])
    }

    @Test
    func `A patch that only removes is a delete — the shape no CLI has a tool for`() async throws {
        let diff = try #require(try await diff("edit-removes"))

        #expect(diff.change == .delete)
        #expect(diff.added == 0)
        #expect(diff.removed == 2)
    }

    @Test
    func `A patch that cannot be read is an empty diff, never a missing row`() async throws {
        let diff = try #require(try await diff("edit-binary"))

        #expect(diff.hunks.isEmpty)
        #expect(diff.added == 0)
        #expect(diff.removed == 0)
        // Neither creation nor deletion is worth claiming from a patch nothing could read.
        #expect(diff.change == .modify)
    }

    @Test
    func `Writing an image file shows what CHANGED, not a render of what it became`() async throws {
        // `.svg` is in the disk-fallback table and a reader is handed over, so only the routing
        // that reads an edit as its patch keeps this a diff rather than a picture of the file as it
        // now stands.
        let diff = try #require(try await diff(
            "edit-svg",
            readImage: fixedImageReader("FROM-DISK"),
        ))

        #expect(diff.change == .create)
        #expect(diff.added == 1)
    }
}
