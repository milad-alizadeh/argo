import SwiftUI

/// Which fixture a case is a render OF, and the one container most of them are drawn in.
///
/// Split from the switch next door because the two answer different questions — that file is the
/// case-by-case list, this is the lookup behind it — and because the list is the half that grows
/// with every state added.
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

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container. Spelled once: most of this catalog is that one
    /// state with a different feed in it, and repeating the call per case made each of them four
    /// lines of plumbing around the one word that differs.
    func sessions(
        _ feed: [FeedRow],
        open: FeedRow.ID? = nil,
        lit: FeedShot? = nil,
        held: FeedRow.ID? = nil,
    )
        -> some View {
        // Named, because a reading is always OF something: a deck whose top zone says nothing is
        // the no-Session-selected state, and every case below has a Session in it.
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            header: SessionHeaderFixture.header(for: .managed),
            open: open,
            lit: lit,
            held: held,
        )
    }
}
