import ArgoEngine
import SwiftUI

/// The zones across the deck, in the order they are read: the rail, the feed, the minimap pinned to
/// the feed it maps, and the evidence panel outboard of all of them.
///
/// The minimap's place is the load-bearing part. It is a map OF the feed, so nothing may come
/// between them — a panel opening in that gap pushed the map away from the column it belongs to and
/// left it reading as a second sidebar. The panel takes the far edge instead.
///
/// Two of the three seams move. The minimap's does not: it is a fixed measure, like Xcode's, and a
/// map wide enough to be a map is not a preference.
struct DeckContentRow: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    /// The composer for the shown Session, and absent for one Argo cannot drive — the absence is
    /// the honest state, not a disabled field (design decision 7).
    var composer: SessionComposerProjection.Composer?
    /// One Turn to the shown Session. A closure so a specimen renders the vessel with nothing
    /// behind it; refusals are thrown back and the composer's seam repeats them.
    var send: ComposerSend = { _, _ in }
    /// The Permission the shown Session is blocked on — it takes the composer's slot.
    var prompt: PermissionPromptProjection.Prompt?
    /// The answer to it, inert by default for the reason `send` is.
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572). Both vessels draw the
    /// tray, so it goes to whichever one is up.
    var revoke: (String) -> Void = { _ in }
    /// What the composer is holding, from above the Session identity so it survives a switch
    /// (#539). See `InstrumentDeckShell.draft`.
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())
    let seams: DeckSeams
    /// Whether either seam is under the reader's hand. One flag for both, because only one of them
    /// can be dragged at a time and the zones downstream care that the column is moving, not which
    /// edge is moving it.
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
            // One transaction for the whole re-flow, driven by whether the panel is open and by
            // nothing else. Three zones move on that one fact — the panel arrives, the rail and the
            // minimap leave — and animating only the panel would slide it in beside two columns
            // that had already blinked out of existence. Scoped to the value rather than left
            // ambient so a feed growing underneath is still laid out instantly.
            .argoAnimation(.reveal, value: isPanelOpen)
            // Escape is the way out of anything that opened over what you were reading, and the
            // panel is no exception. It answers here rather than on the panel so a reader whose
            // focus is still in the feed — which is where the click that opened it came from —
            // does not have to reach into the panel first to be allowed to close it.
            .onExitCommand(perform: dismissTopmost)
            .environment(\.deckIsResizing, isResizing)
        }
    }

    /// Whether the agents rail is on screen at all.
    ///
    /// Only while subagents are actually running. A column standing empty for the whole of every
    /// session that never delegated is a permanent claim that something belongs there — it took a
    /// third of the deck to say nothing, and the feed it took the room from is the thing being
    /// read. It appears when there is a subagent to show and goes when the last one lands.
    ///
    /// And never beside the panel. The two are alternatives rather than neighbours: a reader
    /// looking at what one call produced is not watching a fan-out, and three columns beside a
    /// fourth leaves none of them a usable width.
    private var showsRail: Bool {
        !isPanelOpen && agents.contains(where: \.isRunning)
    }

    /// The one fact the deck's whole re-flow turns on. A `Bool` rather than the evidence itself,
    /// because the evidence is re-read out of a live feed every time the transcript grows — an
    /// animation keyed to it would re-run the whole re-flow whenever the open call's output did.
    private var isPanelOpen: Bool {
        openEvidence != nil
    }

    /// Read once and asked twice — whether the rail is there at all, and what is in it. Two reads
    /// of the same rows could not disagree, but they would be two places to change when the
    /// reading does.
    private var agents: [FeedAgent] {
        FeedAgents.all(in: feed)
    }

    /// Whatever is over what the reader was reading, innermost first.
    ///
    /// Answering here as well as on the lightbox itself is deliberate: `onExitCommand` only fires
    /// for a view in the responder chain, and nothing focuses the lightbox on the way in.
    /// Each closes back onto the row it was opened from, rather than leaving the keyboard on a view
    /// that has just left the screen.
    private func dismissTopmost() {
        if selection.lit != nil {
            selection.darken(returningInto: feed)
        } else {
            selection.close()
        }
    }

    /// The panel and the edge that sizes it, as ONE thing that arrives.
    ///
    /// They are stacked here rather than left as siblings of the deck's own row because of what
    /// `.move` measures: it travels a view by its OWN width, and the seam is a hairline — a
    /// transition it carries alone moves it about a point and reads as a line fading up in the
    /// middle of the feed. Stacked, the pair travels the panel's width, and the seam arrives as
    /// what it is: that column's leading edge.
    ///
    /// In from the edge it lives on, the way a trailing inspector does. The slot opens in the same
    /// transaction, so the feed narrows as it comes rather than after it lands.
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

    /// The panel's width, defaulting to its share of the deck. Of the WHOLE deck, because the rail
    /// and the minimap are both shut while it is open — the feed is the only thing it shares with.
    ///
    /// Seated on a whole point, the opening width included: a share of a fractional deck is a
    /// fraction, and the feed left beside it is a column of prose either way (`ArgoLayout.seated`).
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

    /// The open row's evidence, resolved against the CURRENT feed rather than remembered. A live
    /// transcript grows under the panel, and evidence held by value here would go on showing what
    /// a call produced after the row it belongs to had gone.
    private var openEvidence: FeedEvidence? {
        guard let open = selection.open,
              let content = feed.first(where: { $0.id == open })?.content
        else {
            return nil
        }
        return switch content {
        case let .call(call): call.opened
        case let .survey(survey): survey.opened
        // Prose opens nothing, and neither does a gallery — its shots open a lightbox instead, and
        // routing them through a panel would show a picture beside a smaller copy of itself. A
        // question opens nothing either: what it produced is the answer, and the answer is already
        // the row; an unreadable line produced nothing at all. A row that cannot be clicked into
        // the panel cannot be the open one, so these arms are unreachable — and they are cases
        // rather than a `default` so a new row kind that CAN open fails this build instead of
        // silently resolving to a closed panel.
        case .prompt, .message, .thought, .gallery, .ask, .mark, .unreadable: nil
        }
    }
}

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The Dock seam it used to end in did not survive the composer — the deck's
/// bottom edge belongs to the reading again, and the vessel floats over it (#403, closed by #536).
private struct FeedColumn: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    var composer: SessionComposerProjection.Composer?
    var send: ComposerSend = { _, _ in }
    var prompt: PermissionPromptProjection.Prompt?
    var decide: (PermissionDecision) -> Void = { _ in }
    var revoke: (String) -> Void = { _ in }
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    var body: some View {
        FeedView(rows: feed, selection: selection, held: held, isUnderComposer: hasVessel)
            // Over the feed rather than in the column's stack: the pill floats, and a row in
            // the stack would take height from the reading it is meant to sit above. Bounded
            // to this column so it moves with the feed when a seam does, never over the panel.
            .overlay(alignment: .bottom) { pill }
            .overlay(alignment: .bottom) { vessel }
            // Whatever the two seams leave it. The column used to be capped at its reading measure
            // when the panel opened, which is the panel deciding how wide the feed is — the seam
            // decides now, and prose inside the column is held to the measure by the rows
            // themselves.
            .frame(maxWidth: .infinity)
    }

    private var hasVessel: Bool {
        composer != nil || prompt != nil
    }

    /// A Session that never reported a plan gets no pill — not an empty one, and not a note saying
    /// there is none. Nothing to report is reported by drawing nothing. Lifted clear of the vessel
    /// when one floats under it, for the reason the way-back control is.
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
    /// The field is replaced, not disabled — there is nothing to type into while the agent waits.
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
