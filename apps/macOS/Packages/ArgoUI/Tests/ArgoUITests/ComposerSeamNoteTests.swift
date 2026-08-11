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
}
