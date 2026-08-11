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

    @Test
    func `the seam counts back from when the draft was written`() {
        let hour = 60 * 60 * 1000
        #expect(
            ComposerSeamNote.kept(sinceMs: 0, nowMs: 51 * 60 * 1000)
                == .draftKept("Draft kept from 51m ago"),
        )
        #expect(
            ComposerSeamNote
                .kept(sinceMs: 0, nowMs: 3 * hour) == .draftKept("Draft kept from 3h ago"),
        )
    }

    /// A reader who stepped away for forty seconds is told their words were kept, not handed a
    /// stopwatch reading `0m ago`.
    @Test
    func `a draft younger than a minute is worded rather than counted`() {
        #expect(
            ComposerSeamNote.kept(sinceMs: 0, nowMs: 40000)
                == .draftKept("Draft kept from a moment ago"),
        )
    }
}
