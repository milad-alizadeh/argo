@testable import AtlasLayout
import Foundation
import Testing

/// A Note read against the thing it was written about (#1159). The claim the reader checks with
/// their eyes: a sentence written about an older version of a file is still on screen, and it says
/// so.
@Suite("Atlas — a note that has gone stale against its subject")
struct AtlasNoteStandingTests {
    static let notes = AtlasNotes(files: [
        "argo/a.swift": AtlasNote(words: "A.", subject: "aaaa"),
        "argo/b.swift": AtlasNote(words: "B.", subject: "bbbb"),
        "argo/c.swift": AtlasNote(words: "C."),
    ], folders: ["argo": AtlasNote(words: "The monorepo.")])

    @Test func `a note whose subject still holds what it held reads as current`() {
        let read = Self.notes.checked(against: ["argo/a.swift": "aaaa"])

        #expect(read.note(ofFile: "argo/a.swift")?.standing == .current)
    }

    @Test func `a note whose subject has changed is marked, and stays where it was`() {
        // The whole of the last criterion. A stale note was true of a version of the file the
        // reader may still be reading, so removing it would take that reading with it and leave
        // the panel looking like a file nobody wrote about.
        let read = Self.notes.checked(against: ["argo/a.swift": "zzzz"])

        let note = read.note(ofFile: "argo/a.swift")
        #expect(note?.standing == .stale)
        #expect(note?.words == "A.")
    }

    @Test func `a note nothing could be compared against stays unchecked`() {
        // Two ways to reach it, and neither is a claim about the note: the writer recorded no
        // digest, or the subject could not be read at all. Calling either "current" is how a stale
        // note comes to read as a fresh one when the check quietly fails.
        let read = Self.notes.checked(against: ["argo/c.swift": "cccc"])

        #expect(read.note(ofFile: "argo/c.swift")?.standing == .unchecked)
        #expect(read.note(ofFile: "argo/b.swift")?.standing == .unchecked)
    }

    @Test func `a folder caption is never marked, because a folder holds nothing to digest`() {
        let read = Self.notes.checked(against: ["argo": "aaaa"])

        #expect(read.note(ofFolder: "argo")?.standing == .unchecked)
    }

    @Test func `the subjects to digest are the files a note recorded one for, in one order`() {
        // What the caller opens. Sorted rather than the dictionary's own order, because a set
        // walked in its own order is how one run comes out different from the next.
        #expect(Self.notes.subjects == ["argo/a.swift", "argo/b.swift"])
    }

    @Test func `checking a written layer changes nothing else about it`() {
        // The sentences, their flags and the provenance survive the check: this reads a note, it
        // does not rewrite one.
        let written = AtlasNotes(
            writtenAt: Date(timeIntervalSince1970: 0), model: "sonnet",
            files: ["argo/a.swift": AtlasNote(words: "A.", why: ["Large."], subject: "aaaa")],
        )

        let read = written.checked(against: ["argo/a.swift": "zzzz"])

        #expect(read.model == "sonnet")
        #expect(read.writtenAt == written.writtenAt)
        #expect(read.note(ofFile: "argo/a.swift")?.why == ["Large."])
    }
}
