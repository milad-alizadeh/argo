import SwiftUI

/// What the catalog's cases are BUILT from, kept off the switch itself: the switch is a list of
/// states and reads as one, and a fixture lookup or a four-argument shell call sitting between two
/// cases turns that list into plumbing.
extension SpecimenScreen {
    /// The header whose context tier this case is a render of. The fixture set names the case it
    /// belongs to, so neither side can be renamed into drawing another tier's reading.
    var contextHeader: SessionHeaderProjection.Header {
        SessionHeaderFixture.contexts.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// The header whose handoff state this case is a render of, keyed the same way the tiers are.
    var handoffHeader: SessionHeaderProjection.Header {
        SessionHeaderFixture.handoffs.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// The header whose spend line this case is a render of, keyed the same way the tiers are.
    var spendHeader: SessionHeaderProjection.Header {
        SessionSpendFixture.spends.first { $0.specimen == specimen }?.header
            ?? SessionHeaderFixture.header(for: .managed)
    }

    /// The folded run of looking, open — and optionally open AT one of the results listed under it,
    /// which is the state a click on one of those names produces. Spelled here rather than twice in
    /// the switch: the two cases differ by one argument, and the pane they render is the same pane.
    func survey(at step: Int? = nil) -> some View {
        sessions(
            FeedProjection.previewCallRows,
            open: FeedProjection.previewSurveyRowID,
            step: step,
        )
    }

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container. Spelled once: most of this catalog is that one
    /// state with a different feed in it, and repeating the call per case made each of them four
    /// lines of plumbing around the one word that differs.
    func sessions(
        _ feed: [FeedRow],
        open: FeedRow.ID? = nil,
        step: Int? = nil,
        lit: FeedShot? = nil,
        held: FeedRow.ID? = nil,
        composer: SessionComposerProjection.Composer? = nil,
        prompt: PermissionPromptProjection.Prompt? = nil,
    )
        -> some View {
        // Named, because a reading is always OF something: a deck whose top zone says nothing is
        // the no-Session-selected state, and every case below has a Session in it.
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            // A prompt in the composer's slot IS the Session's status, so the band above it is
            // read off the same fact rather than named per case: a deck that says nothing while a
            // Permission is pending under it is a contradiction the catalog would be teaching.
            header: prompt == nil
                ? SessionHeaderFixture.header(for: .managed)
                : SessionHeaderFixture.needsInput,
            open: open,
            step: step,
            lit: lit,
            held: held,
            composer: composer,
            prompt: prompt,
        )
    }
}
