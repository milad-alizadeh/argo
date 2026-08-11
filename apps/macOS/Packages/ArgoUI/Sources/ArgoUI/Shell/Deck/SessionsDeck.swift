import ArgoEngine
import SwiftUI

/// The Sessions room's zone layout, stacked flush. It paints no background: `InstrumentDeckShell`
/// is the opaque plane, and a second fill here would be a second surface where the contract allows
/// one. Nothing is drawn between the header and its tabs — they read as one region.
struct SessionsDeck: View {
    /// The selected Session's reading, projected above the deck.
    let feed: [FeedRow]
    /// What the top zone names. Absent when nothing is selected: the zone keeps its height and
    /// says nothing.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one. Inert by default so a specimen draws the
    /// button without spawning anything.
    var handOff: () async -> Void = {}
    /// The selected Session's plan — standing state rather than a row, so it arrives beside the
    /// rows and not among them.
    var showing = PlanShowing()
    /// Which call's evidence the panel is showing, if any. Held by the deck: the feed cannot own a
    /// selection that resizes the row it sits in.
    @State var open: FeedRow.ID?
    /// Which result inside the open row the panel is showing — see `FeedRowSelection.step`.
    @State var step: Int?
    /// Which picture is open full size. Held HERE because the lightbox covers the whole deck.
    @State var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. Where the reading STARTS; the
    /// scroll owns it from there.
    var held: FeedRow.ID?
    /// The shown Session's composer. Absent for a Session Argo cannot drive, which draws nothing
    /// rather than a disabled field.
    var composer: SessionComposerProjection.Composer?
    /// One Turn to the shown Session. Inert by default so a specimen draws the vessel without
    /// reaching for a terminal.
    var send: ComposerSend = { _, _ in }
    /// The Permission the shown Session is blocked on. Displaces the composer.
    var prompt: PermissionPromptProjection.Prompt?
    /// The answer to it. Inert by default for the reason `send` is.
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572). Inert by default too.
    var revoke: (String) -> Void = { _ in }
    /// Stopping the Turn in flight (#541). Inert by default, for the reason `send` is.
    var stop: () throws -> Void = {}
    /// Putting the Session on a rung of the Mode ladder (#545); refused rungs reach the seam.
    var setMode: (SessionMode) throws -> Void = { _ in }
    /// What the composer is holding — passed through from above the Session identity, so an unsent
    /// draft survives a switch (#539). See `InstrumentDeckShell.draft`.
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())
    /// Where the reader dragged the deck's seams — held above this view, never in it. See
    /// `DeckSeams`.
    var seams = DeckSeams.unheld
    /// Where the keyboard is across the whole reading — the feed, the panel and the lightbox in one
    /// space, so focus can come back out of the two that cover it. See `FeedFocus`.
    @FocusState private var focus: FeedFocus?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            SessionHeader(header: header, handOff: handOff)
                .frame(height: ArgoLayout.deckHeaderHeight)
            SessionTabLine(spend: header?.spend)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeparator()
            DeckContentRow(
                feed: feed,
                showing: showing,
                selection: selection,
                held: held,
                composer: composer,
                send: send,
                prompt: prompt,
                decide: decide,
                revoke: revoke,
                stop: stop,
                setMode: setMode,
                draft: draft,
                seams: seams,
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoLightbox(selection, in: feed)
    }

    private var selection: FeedRowSelection {
        FeedRowSelection(open: $open, step: $step, lit: $lit, focus: $focus)
    }
}

#Preview("Sessions deck — zones") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — a call's evidence open beside the feed") {
    SessionsDeck(feed: FeedProjection.previewRows, open: FeedProjection.previewFailedCallID)
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — the plan's list open over the feed") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        showing: PlanShowing(plan: PlanFixture.working, isRevealed: true),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

// No plan on this one, and that is the point: a Session that never reported one shows no pill.
#Preview("Sessions deck — a Session that has said nothing") {
    SessionsDeck(feed: [])
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — narrowest deck the window allows") {
    SessionsDeck(feed: FeedProjection.previewRows)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}
