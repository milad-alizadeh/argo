import ArgoUI
import SwiftUI

/// The deck's chrome: the window title that took the identity band's title (#692), and the tab
/// line that took its instruments before the band was deleted (#693). One entry per access
/// posture, and one per reading the tab line has to carry.
///
/// The posture entries render the TITLE rather than the tab line, because that is where a posture
/// is drawn — the line draws the state word, the offer and the instrument, none of which the
/// posture decides. The line's own entries are the two keyed families below it.
///
/// Those families are MAPPED from their fixtures rather than listed again here. A tier or an offer
/// state is added to its fixture list and is renderable from that one edit — there is no second
/// list for it to drift from.
///
/// There is no spend entry: the telemetry is on the title's hover now, and a native tooltip never
/// lands in a screenshot (`SessionHeaderTooltipTests` holds it instead).
extension SpecimenRegistry {
    static let header: [SpecimenEntry] = postures + contexts + handoffs + [
        // A popover is its own window and never lands in a screenshot of this one.
        SpecimenEntry("contextGuide") { ContextGuideSpecimen(header: SessionHeaderFixture.guided) },
        // The same panel where almost nothing could be read: the block collapses to its one
        // permanent row rather than drawing a column of dashes (#694).
        SpecimenEntry("contextGuideUnread") {
            ContextGuideSpecimen(header: SessionHeaderFixture.unguided)
        },
        // The Issue row over a branch that names no ticket (#894). It used to VANISH here, which a
        // reader cannot tell from a panel that failed to load — and no fixture had ever reached the
        // state, so no render had ever shown it.
        SpecimenEntry("contextGuideUnlinked") {
            ContextGuideSpecimen(header: SessionHeaderFixture.unlinked)
        },
        // Whether the companion channel is live, in all four of its states at once (#493). One
        // entry rather than four, because the state that draws NOTHING is only judgeable beside
        // the three that draw something.
        SpecimenEntry("companionChannel") { CompanionChannelSpecimen() },
        // No button left on the red header, and the reading ends in a link to the next Session.
        SpecimenEntry("handedOffReading") {
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewHandedOffRows,
                header: SessionHeaderFixture.handedOff,
            )
        },
        // The ordinary managed Session, which the two families above vary from. Its ticket is
        // `.linked` (#1092), so this is also the tab line's pressable Issue link at rest.
        SpecimenEntry("tabLineInstruments") { SessionHeaderSpecimen(access: .managed) },
        // Only `permission`, `asking` and `stopped` spend a state word, and no family varies it.
        SpecimenEntry("tabLineStateWord") {
            SessionHeaderSpecimen(header: SessionHeaderFixture.needsInput)
        },
        // The tab line's Issue link over the other two readings (#1092): `unlinked` states the
        // word with no route, and `unread` draws nothing at all — `tabLineInstruments` above is
        // the third, `.linked`.
        SpecimenEntry("tabLineIssueUnlinked") {
            SessionHeaderSpecimen(header: SessionHeaderFixture.unlinked)
        },
        SpecimenEntry("tabLineIssueUnread") {
            SessionHeaderSpecimen(header: SessionHeaderFixture.unread)
        },
        // The same `unlinked` reading with a backlog behind it (#1092): the dead-end word becomes
        // the verb that attaches this Session to a Ticket, which is the only link most Sessions
        // will ever have — nothing about a `ticket-<words>` worktree names a number.
        SpecimenEntry("tabLineIssueOffered") {
            SessionHeaderSpecimen(header: SessionHeaderFixture.unlinked)
                .environment(\.argoTicketLinking, SessionHeaderFixture.offering)
        },
    ]

    private static let postures: [SpecimenEntry] = [
        SpecimenEntry("titlebarTitle") { titlebar(.managed) },
        SpecimenEntry("externalTitlebarTitle") { titlebar(.external) },
        SpecimenEntry("orphanedTitlebarTitle") { titlebar(.orphaned) },
        // The same title at the narrowest pane the window allows: it cuts at the TAIL, and the
        // posture word beside it survives the cut rather than being what gives way.
        SpecimenEntry("cutTitlebarTitle") {
            TitlebarTitleSpecimen(
                header: SessionHeaderFixture.header(for: .external),
                paneWidth: TitlebarTitleSpecimen.narrowPane,
            )
        },
        // Nothing selected: the bar holds its height with no word on it.
        SpecimenEntry("emptyTitlebarTitle") { TitlebarTitleSpecimen(header: nil) },
    ]

    private static let contexts: [SpecimenEntry] = SessionHeaderFixture.contexts.map { tier in
        SpecimenEntry(tier.name) { SessionHeaderSpecimen(header: tier.header) }
    }

    private static let handoffs: [SpecimenEntry] = SessionHeaderFixture.handoffs.map { offer in
        SpecimenEntry(offer.name) { SessionHeaderSpecimen(header: offer.header) }
    }

    private static func titlebar(
        _ access: CockpitPresentation.Session.Access,
    )
        -> TitlebarTitleSpecimen {
        TitlebarTitleSpecimen(header: SessionHeaderFixture.header(for: access))
    }
}
