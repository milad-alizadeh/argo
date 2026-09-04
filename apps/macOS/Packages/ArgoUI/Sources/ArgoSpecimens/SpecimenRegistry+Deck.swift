import ArgoAtoms
import ArgoUI
import SwiftUI

/// The assembled deck, and the two things that ride over it without being the reading: the plan
/// pill and the floating controls.
extension SpecimenRegistry {
    static let deck: [SpecimenEntry] = [
        SpecimenEntry("deck") { DeckSpecimen() },
        // The shell, not `SessionsDeck` — the assembled container is the plane plus its zones.
        SpecimenEntry("sessionsDeck") { InstrumentDeckShell(room: .sessions) },
        // The reading has to be long enough to reach the chrome bar, or there is nothing behind it
        // to blur and the entry proves only that a bar was drawn.
        SpecimenEntry("deckCanopy") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        // A shipping gate: the bar with the optical response gone, header and all.
        SpecimenEntry("flatDeckCanopy") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
                .argoWithoutTransparency()
        },
        // The two no-selection states, which read as one thing until #404. Both are the WHOLE
        // window, for the reason `UnselectedDeckSpecimen` gives.
        SpecimenEntry("deckUnselected") { UnselectedDeckSpecimen() },
        SpecimenEntry("deckNoSessions") { RosterSpecimen(presentation: .emptyPreview) },
        // The third: a Session IS selected and Argo has not read it yet, which is the state every
        // switch passes through and the one a large Session sits in while its document is measured
        // (ADR-0030, Rule 3). SEEDED overdue rather than waited for — the word is held back
        // `ArgoMotion.unreadDelay`, and a specimen that raced its own subject's timer would render
        // blank and read as a broken harness.
        //
        // Overdue is also the only state with anything under the word: past the delay it gains the
        // activity indicator, which is the half of this entry #1112 added.
        SpecimenEntry("deckUnread") {
            FeedSilence(overdue: true)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .argoDeckSurface()
                .environment(\.argoFeedVacancy, .unread)
        },
        // The same state INSIDE the delay: the word held back and the indicator with it, which is
        // what every switch that resolves quickly looks like. Rendered because "nothing at all" is
        // a claim a still can make and prose cannot (#1106).
        SpecimenEntry("deckUnreadHeld") {
            FeedSilence(overdue: false)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .argoDeckSurface()
                .environment(\.argoFeedVacancy, .unread)
        },
        // The whole deck with no document under it, which is where lane 5's half of the state can
        // be LOOKED at: the overview lane is absent and its column is held open beside the reading
        // (ADR-0030, Rule 7; `MinimapLaneZone`). Read beside `deckCanopy`, where the same column
        // carries the lane, so the pair shows the swap and shows the width not moving with it.
        //
        // Said plainly, because a still cannot: this reaches the state through a reading with no
        // ROWS, not through one being measured. Both are `FeedTableHandle.isSettled` being false
        // and there is no third way to draw this column, but a measure is seconds long and a
        // render that raced one would come out blank. That the lane and the feed's own word flip
        // on the one fact is `FeedSettledDocumentTests`', where it can be asserted rather than
        // photographed.
        SpecimenEntry("deckUnreadLane") {
            SpecimenScene.sessions([])
                .environment(\.argoFeedVacancy, .unread)
        },
        // The deck mid-drag: the reading at the width it was measured across, cut off by a pane the
        // reader has narrowed since (ADR-0030, Rule 6). See `FrozenResizeSpecimen`.
        SpecimenEntry("deckFrozenResize") { FrozenResizeSpecimen() },
        SpecimenEntry("planPill") { PlanSpecimen(plan: PlanFixture.working) },
        // Reachable only by hovering or tabbing.
        SpecimenEntry("openPlanPill") {
            PlanSpecimen(plan: PlanFixture.working, isRevealed: true)
        },
        // The pill's ring (#713). The pointer's version of this state is `planPill` above: focus
        // reaches nothing but the ring, so a reader working the pointer sees that render exactly.
        SpecimenEntry("cursoredPlanPill") {
            PlanSpecimen(plan: PlanFixture.working, isCursored: true)
        },
        // The state #1225 was reported in: the pill over a composer. What is being judged is the
        // gap between the two, and that the reading's last row clears the pill's whole lane.
        SpecimenEntry("planPillOverComposer") {
            PlanSpecimen(
                plan: PlanFixture.working,
                vessel: .composer(ComposerSpecimen.composer),
            )
        },
        SpecimenEntry("unstartedPlanPill") {
            PlanSpecimen(plan: PlanFixture.unstarted, isRevealed: true)
        },
        // Every control #718 names, on screen at once, so one Tab walk can reach all of them. The
        // context is at the warn line because that is what puts Hand off on the header — at the
        // ordinary reading the offer is withheld and there is no button to tab to. The draft is
        // there for the same reason: Send is disabled on an empty field, and a disabled button is
        // not a Tab stop (#764).
        SpecimenEntry("keyboardDeck") {
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.longRows,
                header: SessionHeaderFixture.header(context: .held(216_764)),
                vessel: .composer(ComposerSpecimen.composer),
                intents: DeckIntents(draft: .constant(ComposerDraft(text: "Something to send."))),
            )
        },
        // The tabs zone, which read `Deck tabs · placeholder` in every deck render until #404.
        // At rest first — one drawn tab under its Ion rule, because Delivery's pane is #269 and a
        // tab is only drawn once pressing it would change what the deck reads.
        SpecimenEntry("deckTabs") { DeckTabsSpecimen() },
        // Then the ring: the zone is a control now, so the keyboard has somewhere to land in it,
        // which is the one criterion #404 was left holding.
        SpecimenEntry("cursoredDeckTabs") { DeckTabsSpecimen(isCursored: true) },
        SpecimenEntry("floatingControls") { FloatingControlsSpecimen() },
        // A shipping gate: the three stay legible and pressable with the optical response gone.
        SpecimenEntry("flatFloatingControls") { FloatingControlsSpecimen(isFlat: true) },
    ]
}
