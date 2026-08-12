import SwiftUI

/// The band at the top of the deck: one entry per access posture, and one per reading the fact
/// line has to carry.
///
/// The three keyed families are MAPPED from their fixtures rather than listed again here. A tier,
/// an offer state or a spend line is added to its fixture list and is renderable from that one
/// edit — there is no second list for it to drift from.
extension SpecimenRegistry {
    static let header: [SpecimenEntry] = postures + contexts + handoffs + spends + [
        // A popover is its own window and never lands in a screenshot of this one.
        SpecimenEntry("contextGuide") { ContextGuideSpecimen() },
        // No button left on the red header, and the reading ends in a link to the next Session.
        SpecimenEntry("handedOffReading") {
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewHandedOffRows,
                header: SessionHeaderFixture.handedOff,
            )
        },
    ]

    private static let postures: [SpecimenEntry] = [
        SpecimenEntry("sessionHeader") { SessionHeaderSpecimen(access: .managed) },
        SpecimenEntry("externalSessionHeader") { SessionHeaderSpecimen(access: .external) },
        SpecimenEntry("orphanedSessionHeader") { SessionHeaderSpecimen(access: .orphaned) },
        // Render narrow too (`ARGO_WINDOW_SIZE`): the branch cuts, the marks/model/issue survive.
        SpecimenEntry("longBranchSessionHeader") {
            SessionHeaderSpecimen(header: SessionHeaderFixture.longBranch)
        },
    ]

    private static let contexts: [SpecimenEntry] = SessionHeaderFixture.contexts.map { tier in
        SpecimenEntry(tier.name) { SessionHeaderSpecimen(header: tier.header) }
    }

    private static let handoffs: [SpecimenEntry] = SessionHeaderFixture.handoffs.map { offer in
        SpecimenEntry(offer.name) { SessionHeaderSpecimen(header: offer.header) }
    }

    private static let spends: [SpecimenEntry] = SessionSpendFixture.spends.map { spend in
        SpecimenEntry(spend.name) { SessionHeaderSpecimen(header: spend.header) }
    }
}
