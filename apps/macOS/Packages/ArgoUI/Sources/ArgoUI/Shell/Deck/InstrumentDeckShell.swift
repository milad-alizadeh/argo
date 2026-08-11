import ArgoEngine
import SwiftUI

/// The opaque plane filling the detail side of the split view, flush to the window. It is the
/// ground the glass canopy is read against, so it is the one surface that must not borrow the
/// canopy's material (D10, D40).
struct InstrumentDeckShell: View {
    let room: CockpitRoom
    /// Which Session the deck is reading, as an IDENTITY rather than as content — nothing below
    /// draws it. `FeedRow.ID` is a dense POSITION, so a pane keyed on the rows reads one Session as
    /// a continuation of the last and opens the new reading mid-scroll.
    var session: CockpitPresentation.Session.ID?
    /// The selected Session's reading, already projected. Rooms with no feed ignore it.
    var feed: [FeedRow] = []
    /// What the deck's top zone names, already projected.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one. Inert by default, so a specimen draws the
    /// button without spawning anything.
    var handOff: () async -> Void = {}
    /// The same Session's plan, which is standing state rather than a row.
    var showing = PlanShowing()
    /// Which call's evidence the deck opens with. A parameter so a specimen can render the panel
    /// open — the state is the deck's, and there is no other way to reach it without a click.
    var open: FeedRow.ID?
    /// Which result inside that row the deck opens AT. A parameter for the reason `open` is: a
    /// screenshot cannot click.
    var step: Int?
    /// Which picture the deck opens full size, for the same reason `open` is a parameter.
    var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. A parameter because a screenshot
    /// cannot scroll.
    var held: FeedRow.ID?
    /// The shown Session's composer, already projected — absent for one Argo cannot drive.
    var composer: SessionComposerProjection.Composer?
    /// One Turn to the shown Session. Inert by default, so a specimen renders the vessel with
    /// nothing behind it.
    var send: ComposerSend = { _, _ in }
    /// The Permission the shown Session is blocked on — it takes the composer's slot while present
    /// (design decision 6).
    var prompt: PermissionPromptProjection.Prompt?
    /// The answer to it. Inert by default, for the reason `send` is.
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572). Inert by default too.
    var revoke: (String) -> Void = { _ in }
    /// Stopping the Turn the shown Session is running (#541). Inert by default, for the reason
    /// `send` is.
    var stop: () throws -> Void = {}
    /// Putting the Session on a rung of the Mode ladder (#545); refused rungs reach the seam.
    var setMode: (SessionMode) throws -> Void = { _ in }
    /// What the shown Session's composer is holding. A binding handed in from ABOVE the identity
    /// below: `.id(session)` discards everything under it on a switch, and an unsent draft must
    /// survive one (#539).
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    /// Where the reader dragged the deck's seams. Owned HERE, above the identity below — keyed with
    /// the room it would snap back to its opening width on every Session switch.
    @State private var railWidth = ArgoLayout.agentsRailWidth
    @State private var panelWidth: CGFloat?

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            .accessibilityElement(children: .contain)
            .accessibilityLabel("\(room.title) Instrument Deck")
    }

    /// The other rooms are bare ground on purpose: a placeholder deck in Work would claim a
    /// structure nobody has decided.
    @ViewBuilder private var content: some View {
        switch room {
        case .sessions:
            SessionsDeck(
                feed: feed,
                header: header,
                handOff: handOff,
                showing: showing,
                open: open,
                step: step,
                lit: lit,
                held: held,
                composer: composer,
                send: send,
                prompt: prompt,
                decide: decide,
                revoke: revoke,
                stop: stop,
                setMode: setMode,
                draft: draft,
                seams: DeckSeams(rail: $railWidth, panel: $panelWidth),
            )
            // SwiftUI discards a view's whole state when its id changes. On the DECK and not the
            // feed alone: the panel and the lightbox are keyed to rows too, and an open panel
            // carried across reopens on whatever call now sits at that position. Everything under
            // this has to be per-Session, which is why the seams above are held outside it.
            .id(session)
        case .work, .code:
            Color.clear
        }
    }
}

#Preview("Instrument Deck — Sessions") {
    InstrumentDeckShell(
        room: .sessions,
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoAppearance()
}

#Preview("Instrument Deck — a Session with nothing read yet") {
    InstrumentDeckShell(room: .sessions)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Instrument Deck — a room with no zones yet") {
    InstrumentDeckShell(room: .work)
        .frame(width: 860, height: 620)
        .argoAppearance()
}
