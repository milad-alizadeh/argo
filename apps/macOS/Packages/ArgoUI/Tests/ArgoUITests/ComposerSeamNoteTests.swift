import ArgoEngine
@testable import ArgoUI
import Testing

/// What the line above the vessel says about a draft that was kept, and how long ago it was
/// written — the seam's words, beside the seam rather than beside the store that stamps the time.
@Suite("Composer seam note")
struct ComposerSeamNoteTests {
    @Test
    func `the note counts back from when the draft was written`() {
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

    /// A clock reading behind the stamp is two machines disagreeing about the second, never a
    /// draft written in the future.
    @Test
    func `a stamp in the future reads as a moment ago rather than a negative age`() {
        #expect(
            ComposerSeamNote.kept(sinceMs: 9_000_000, nowMs: 1_000_000)
                == .draftKept("Draft kept from a moment ago"),
        )
    }

    /// A rung that did not land is the seam's business, because the picker has already moved back
    /// on its own and nothing else says why (#629).
    @Test
    func `a rung that did not take takes the seam`() {
        let note = ComposerSeamNote.note(
            for: ComposerDraft(),
            enteredAtMs: 0,
            modeDidNotTake: .auto,
        )

        #expect(note == .notice("Auto did not take. The session is still on the rung shown."))
    }

    /// A refusal still outranks it: those words are unsent and at risk, and the seam is ONE line.
    @Test
    func `a refused send outranks a rung that did not take`() {
        let draft = ComposerDraft(refusal: "The session is not accepting input")

        let note = ComposerSeamNote.note(for: draft, enteredAtMs: 0, modeDidNotTake: .auto)

        #expect(note == .refusal("The session is not accepting input"))
    }
}
