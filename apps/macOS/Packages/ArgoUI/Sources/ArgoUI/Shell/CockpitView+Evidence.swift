import SwiftUI

/// The evidence panel as the SHELL holds it (#875 finding 5).
///
/// The panel used to open from a feed row and close from its own header, with no way back to it
/// once closed. Giving it a toolbar control meant lifting what it is open on out of `SessionsDeck`,
/// because the toolbar is outside the deck — and out of the deck's `.id(session)` with it, which is
/// what `forgetEvidence()` replaces: the deck's per-Session identity used to discard this state for
/// free, and now the shell has to say so.
extension CockpitView {
    /// The rows the panel and its control are resolved against: the Session's own, or the
    /// Subagent's the rail scoped onto. The toggle opens what is ON SCREEN, so it asks the same
    /// question the deck's zones do, through the same answer.
    var evidenceReading: [FeedRow] {
        let reading = reading
        return reading.readings.reading(of: reading.feed, under: feedScope)
    }

    var evidenceToggling: EvidenceToggling {
        EvidenceToggling(feed: evidenceReading, open: openEvidence)
    }

    /// The step goes with the row: a panel opened on a different call has no business resuming at
    /// whichever result the last one was showing.
    func toggleEvidence() {
        openEvidence = evidenceToggling.next
        evidenceStep = nil
    }

    /// Everything the panel is holding, dropped. `FeedRow.ID` is a dense POSITION, so a panel
    /// carried across a Session switch reopens on whatever call now sits where the old one was —
    /// and a scope names a delegation of the Session being left.
    func forgetEvidence() {
        openEvidence = nil
        evidenceStep = nil
        feedScope = .session
    }

    /// The toggle, in the room that has a panel and `nil` in the others. It is handed to
    /// `ShellToolbar` rather than declared beside it — see the note on `ShellToolbar.evidence`.
    var evidenceControl: EvidenceToggle? {
        guard navigation.room == .sessions else { return nil }
        return EvidenceToggle(toggling: evidenceToggling, act: toggleEvidence)
    }
}
