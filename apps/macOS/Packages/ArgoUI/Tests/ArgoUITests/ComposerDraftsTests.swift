import ArgoEngine
@testable import ArgoUI
import Testing

/// A draft survives leaving the Session and coming back, and the seam can say when it was written.
@Suite("Composer drafts")
@MainActor
struct ComposerDraftsTests {
    @Test
    func `a draft left on one Session is still there after visiting another`() {
        let drafts = ComposerDrafts(now: { 0 })
        drafts["session-a"] = ComposerDraft(text: "Before the PR: check the anchor.")

        drafts["session-b"] = ComposerDraft(text: "Something else entirely.")

        #expect(drafts["session-a"].text == "Before the PR: check the anchor.")
        #expect(drafts["session-b"].text == "Something else entirely.")
    }

    @Test
    func `a Session nobody has typed in holds an empty draft, never an absence`() {
        #expect(ComposerDrafts()["session-a"] == ComposerDraft())
    }

    /// The store grows with what people typed, not with every Session they clicked on. Reading a
    /// dropped entry back gives an empty draft, which is what makes the absence free.
    @Test
    func `a draft holding nothing is dropped rather than kept`() {
        let drafts = ComposerDrafts(now: { 0 })
        drafts["session-a"] = ComposerDraft(text: "Fix the caption.")

        drafts["session-a"] = ComposerDraft()

        #expect(drafts["session-a"] == ComposerDraft())
        #expect(drafts.isEmpty)
    }

    /// A refusal the reader has not seen yet is something to hold: dropping it with the words
    /// would take the reason off the seam on the way back.
    @Test
    func `a draft holding only a refusal is still held`() {
        let drafts = ComposerDrafts(now: { 0 })
        var draft = ComposerDraft(text: "Carry on.")
        draft.send { _ in throw SessionDriveError.notDrivable }
        draft.text = ""

        drafts["session-a"] = draft

        #expect(!drafts.isEmpty)
    }

    @Test
    func `writing the text stamps when it was written`() {
        let drafts = ComposerDrafts(now: { 1_000_000 })

        drafts["session-a"] = ComposerDraft(text: "Fix the caption.")

        #expect(drafts["session-a"].editedAtMs == 1_000_000)
    }

    /// The clock the seam counts back from is the USER's, not the app's. A send, a queued
    /// follow-up or a refusal rewrites the draft without anybody typing, and a stamp that moved
    /// for those would make an hour-old draft read as a fresh one.
    @Test
    func `a change that is not the text leaves the stamp where it was`() {
        var clock = 1_000_000
        let drafts = ComposerDrafts(now: { clock })
        drafts["session-a"] = ComposerDraft(text: "Fix the caption.")
        clock = 9_000_000

        // The same words, refused — the shape a failed send leaves behind (design decision 8).
        var draft = drafts["session-a"]
        draft.send { _ in throw SessionDriveError.notDrivable }
        drafts["session-a"] = draft

        #expect(drafts["session-a"].text == "Fix the caption.")
        #expect(drafts["session-a"].editedAtMs == 1_000_000)
    }
}
