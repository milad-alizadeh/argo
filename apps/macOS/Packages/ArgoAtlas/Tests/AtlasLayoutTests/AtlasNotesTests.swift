@testable import AtlasLayout
import Foundation
import Testing

/// The written layer, read from its own file (#1159). Every claim here is one a reader could check
/// with their eyes on the panel: which sentence stands beside which file, and what a repository
/// that has none of them is told.
@Suite("Atlas — the written layer")
struct AtlasNotesTests {
    /// A written layer holding both kinds of subject, one flag, and one recorded digest. Written
    /// inline rather than off the fixture, for `AtlasMapFailureTests`' reason: these are cases
    /// about the bytes, and the fixture is a real measurement of a real repository.
    static let layer = Data("""
    {"version": 1, "writtenAt": "2026-09-02T00:00:00Z", "model": "sonnet",
     "folders": {"argo/rules": {"note": "The house rules no linter can check."}},
     "files": {"argo/rules/house.md":
                 {"note": "What a model does not do unprompted, stated once.",
                  "why": ["One of the largest files here."],
                  "subject": "373c133d4049e869"}}}
    """.utf8)

    @Test func `a note is read with the flag that got it written and the subject it names`()
        throws {
        // The flag is the question the measurements asked. It is kept beside the answer because a
        // sentence about somebody's code with no question in front of it reads as an opinion.
        let notes = try #require(AtlasNotes(decoding: Self.layer))

        let note = try #require(notes.note(ofFile: "argo/rules/house.md"))
        #expect(note.words == "What a model does not do unprompted, stated once.")
        #expect(note.why == ["One of the largest files here."])
        #expect(note.subject == "373c133d4049e869")
        #expect(notes.model == "sonnet")
    }

    @Test func `a folder carries its own caption, and a file at that path does not`() throws {
        // Two namespaces in one file, because a Plate and a Plot are different subjects: a caption
        // says what lives in a place, and a note says what one file is for.
        let notes = try #require(AtlasNotes(decoding: Self.layer))

        #expect(notes.note(ofFolder: "argo/rules")?.words == "The house rules no linter can check.")
        #expect(notes.note(ofFile: "argo/rules") == nil)
        #expect(notes.note(ofFolder: "argo/rules/house.md") == nil)
    }

    @Test func `a file nobody wrote about carries no note at all`() throws {
        // Nothing rather than an empty sentence: the panel draws no block at all for a file with
        // no note, which is what keeps a map of an unwritten repository identical to this one.
        let notes = try #require(AtlasNotes(decoding: Self.layer))

        #expect(notes.note(ofFile: "argo/rules/swift.md") == nil)
    }

    @Test func `a repository with no written layer reads as nothing said, not as a failure`() {
        // The ticket's second criterion, at the seam that decides it: a Map drawn beside NOTHING
        // is the same Map, and the value that stands for "no file there" is a value rather than
        // an error nobody can act on.
        #expect(AtlasNotes.none.isEmpty)
        #expect(AtlasNotes.none.note(ofFile: "argo/rules/house.md") == nil)
    }

    @Test func `bytes that are not a written layer say nothing rather than blame the Project`() {
        // Unlike the Map, whose reader has an error case for every way its bytes can be wrong: the
        // Map is what the reader asked for and this is not, so a half-written or foreign file is
        // read as a repository nobody has written about (#1159's "its absence is not an error").
        #expect(AtlasNotes(decoding: Data("not json at all".utf8)) == nil)
        #expect(AtlasNotes(decoding: Data("{}".utf8)) == nil)
    }

    @Test func `a written layer from a version this reader does not know says nothing`() {
        // Its own shape can change, and a file written by a later Argo would otherwise be read
        // against this reader's idea of what a note is.
        let later = Data(#"{"version": 2, "files": {"a": {"note": "later"}}}"#.utf8)

        #expect(AtlasNotes(decoding: later) == nil)
    }

    @Test func `a written layer holding only captions reads as a written layer`() throws {
        // A repository whose notes are all about folders is a written layer that said something,
        // so `files` is absent rather than empty and the reader must not take that for an
        // unwritten repository.
        let captions = Data(#"{"version": 1, "folders": {"argo": {"note": "The monorepo."}}}"#.utf8)

        let notes = try #require(AtlasNotes(decoding: captions))
        #expect(!notes.isEmpty)
        #expect(notes.note(ofFolder: "argo")?.words == "The monorepo.")
    }

    @Test func `keys this reader has no use for yet do not stop it reading the notes`() throws {
        // The same file carries the pair notes of #1160 and the domain names of #1158. A reader
        // that refused a file for holding them would break on the ticket after this one.
        let wider = Data("""
        {"version": 1, "files": {"argo/a.swift": {"note": "A."}},
         "pairs": [{"pair": ["argo/a.swift", "argo/b.swift"], "note": "Both."}],
         "domains": {"k": {"name": "Something", "note": "Somewhere."}}}
        """.utf8)

        let notes = try #require(AtlasNotes(decoding: wider))
        #expect(notes.note(ofFile: "argo/a.swift")?.words == "A.")
    }
}
