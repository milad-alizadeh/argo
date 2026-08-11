import ArgoEngine
import SwiftUI

/// The zones across the deck, in the order they are read: the rail, the feed, the minimap pinned to
/// the feed it maps, and the evidence panel outboard of all of them.
///
/// Nothing may come between the minimap and the feed it maps — the panel takes the far edge. The
/// minimap's seam is fixed; the other two move.
struct DeckContentRow: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    /// Absent for a Session Argo cannot drive — the absence is the honest state, not a disabled
    /// field (design decision 7).
    var composer: SessionComposerProjection.Composer?
    /// One Turn to the shown Session; refusals are thrown back and the composer's seam repeats
    /// them.
    var send: (String) throws -> Void = { _ in }
    /// The Permission the shown Session is blocked on — it takes the composer's slot.
    var prompt: PermissionPromptProjection.Prompt?
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572).
    var revoke: (String) -> Void = { _ in }
    /// From above the Session identity so it survives a switch (#539). See
    /// `InstrumentDeckShell.draft`.
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())
    let seams: DeckSeams
    /// One flag for both seams — only one of them can be dragged at a time.
    @State private var isResizing = false

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                if showsRail {
                    AgentsRail(agents: agents)
                        .frame(width: seams.rail.wrappedValue)
                    DeckSeam(
                        width: seams.rail,
                        limits: railLimits(in: proxy.size.width),
                        growsRightward: true,
                        isDragging: { isResizing = $0 },
                    )
                }
                FeedColumn(
                    feed: feed,
                    showing: showing,
                    selection: selection,
                    held: held,
                    composer: composer,
                    send: send,
                    prompt: prompt,
                    decide: decide,
                    revoke: revoke,
                    draft: draft,
                )
                if !isPanelOpen {
                    DeckSeparator()
                        .transition(.opacity)
                    DeckSlot(zone: .minimap)
                        .frame(width: ArgoLayout.minimapLaneWidth)
                        .transition(.opacity)
                }
                panel(in: proxy.size.width)
            }
            // One transaction for the whole re-flow: three zones move on the one fact — the panel
            // arrives, the rail and the minimap leave — so animating only the panel slides it in
            // beside two columns that already blinked out. Scoped to the value rather than ambient
            // so a feed growing underneath is still laid out instantly.
            .argoAnimation(.reveal, value: isPanelOpen)
            // Answers here rather than on the panel: the click that opened it came from the feed,
            // so that is where focus still is.
            .onExitCommand(perform: dismissTopmost)
            .environment(\.deckIsResizing, isResizing)
        }
    }

    /// On screen only while subagents are running, and never beside the panel.
    private var showsRail: Bool {
        !isPanelOpen && agents.contains(where: \.isRunning)
    }

    /// A `Bool` rather than the evidence itself: the evidence is re-read out of a live feed every
    /// time the transcript grows, and an animation keyed to it would re-run the whole re-flow.
    private var isPanelOpen: Bool {
        openEvidence != nil
    }

    private var agents: [FeedAgent] {
        FeedAgents.all(in: feed)
    }

    /// Dismisses whatever is over what the reader was reading, innermost first. Answered here as
    /// well as on the lightbox: `onExitCommand` only fires for a view in the responder chain, and
    /// nothing focuses the lightbox on the way in.
    private func dismissTopmost() {
        if selection.lit != nil {
            selection.darken(returningInto: feed)
        } else {
            selection.close()
        }
    }

    /// The panel and the edge that sizes it, stacked as ONE thing that arrives: `.move` travels a
    /// view by its OWN width, and the hairline seam carrying the transition alone would move about
    /// a point. Stacked, the pair travels the panel's width.
    @ViewBuilder private func panel(in deck: CGFloat) -> some View {
        if let evidence = openEvidence {
            HStack(spacing: ArgoSpacing.flush) {
                DeckSeam(
                    width: panelBinding(in: deck),
                    limits: ArgoLayout.evidencePanelLimits(in: deck),
                    growsRightward: false,
                    isDragging: { isResizing = $0 },
                )
                EvidencePanel(
                    evidence: evidence,
                    current: selection.step,
                    dismiss: selection.close,
                )
                .frame(width: panelBinding(in: deck).wrappedValue)
                .focusable()
                .focused(selection.focus, equals: .panel)
            }
            .transition(.move(edge: .trailing))
        }
    }

    /// The panel's width, defaulting to its share of the WHOLE deck — the rail and the minimap are
    /// both shut while it is open. Seated on a whole point, the opening width included
    /// (`ArgoLayout.seated`).
    private func panelBinding(in deck: CGFloat) -> Binding<CGFloat> {
        let limits = ArgoLayout.evidencePanelLimits(in: deck)
        let opening = deck * ArgoLayout.evidencePanelShare
        return Binding(
            get: { ArgoLayout.seated(seams.panel.wrappedValue ?? opening, in: limits) },
            set: { seams.panel.wrappedValue = $0 },
        )
    }

    private func railLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let taken = ArgoLayout.minimapLaneWidth + ArgoLayout.feedMinimumWidth
        let ceiling = min(ArgoLayout.railWidths.upperBound, deck - taken)
        let floor = ArgoLayout.railWidths.lowerBound
        return floor ... max(floor, ceiling)
    }

    /// The open row's evidence, resolved against the CURRENT feed rather than remembered — a live
    /// transcript grows under the panel.
    private var openEvidence: FeedEvidence? {
        guard let open = selection.open,
              let content = feed.first(where: { $0.id == open })?.content
        else {
            return nil
        }
        return switch content {
        case let .call(call): call.opened
        case let .survey(survey): survey.opened
        // A row that cannot be clicked into the panel cannot be the open one, so these arms are
        // unreachable — cases rather than a `default` so a new row kind that CAN open fails this
        // build instead of silently resolving to a closed panel.
        case .prompt, .message, .thought, .gallery, .ask, .mark, .unreadable: nil
        }
    }
}

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The deck's bottom edge carries no Dock seam any more — it belongs to the
/// reading, and the vessel floats over it (#403, closed by #536).
private struct FeedColumn: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    var composer: SessionComposerProjection.Composer?
    var send: (String) throws -> Void = { _ in }
    var prompt: PermissionPromptProjection.Prompt?
    var decide: (PermissionDecision) -> Void = { _ in }
    var revoke: (String) -> Void = { _ in }
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    var body: some View {
        FeedView(rows: feed, selection: selection, held: held, isUnderComposer: hasVessel)
            // Over the feed rather than in the column's stack: a row in the stack would take
            // height from the reading it is meant to sit above. Bounded to this column so it
            // moves with the feed when a seam does, never over the panel.
            .overlay(alignment: .bottom) { pill }
            .overlay(alignment: .bottom) { vessel }
            // Whatever the two seams leave it; prose inside is held to the measure by the rows.
            .frame(maxWidth: .infinity)
    }

    private var hasVessel: Bool {
        composer != nil || prompt != nil
    }

    /// A Session that never reported a plan gets no pill — not an empty one, and not a note saying
    /// there is none. Lifted clear of the vessel when one floats under it.
    @ViewBuilder private var pill: some View {
        if let plan = showing.plan {
            PlanPill(plan: plan, isRevealed: showing.isRevealed)
                .padding(
                    .bottom,
                    hasVessel ? ArgoComposerVessel.feedClearance : ArgoPlanPill.lift,
                )
        }
    }

    /// The prompt takes the composer's own slot: one vessel, holding whichever question is live.
    @ViewBuilder private var vessel: some View {
        if let prompt {
            PermissionPrompt(prompt: prompt, decide: decide, revoke: revoke)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        } else if let composer {
            SessionComposer(composer: composer, send: send, revoke: revoke, draft: draft)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        }
    }
}
