import SwiftUI

/// The hero at the foot of the sidebar's scroll, answering "what should I pick up"
/// (`cockpit-work-room.md` — the Next-up hero).
///
/// Inset, on `surface.raised`, behind an `edge.subtle` border — three things a `ViewRow` has none
/// of, which is what stops it reading as another view.
///
/// A CONTROL where it names a ticket (#898): pressing it opens that ticket in the pane. It is a
/// `Button` and not a row of the `List` it scrolls in — the arrow keys belong to the four views,
/// and the hero is not a fifth (`TicketsSidebar.hero`).
struct NextUpCard: View {
    @Environment(\.argo) private var argo

    /// The card states one ticket, so its title wraps to the rail's width rather than truncating.
    /// Three is where the longest real title in the backlog sets at 280.
    static let titleLines = 3

    let nextUp: NextUp
    /// What pressing it does (#898). Inert by default, so a `#Preview` and a specimen draw the card
    /// pressable with nothing behind it.
    var intents = NextUpIntents.inert

    var body: some View {
        stated
            .padding(.horizontal, ArgoTicketsSidebar.heroInset)
            .padding(.top, ArgoTicketsSidebar.heroInset)
            .padding(.bottom, ArgoTicketsSidebar.heroFootInset)
    }

    /// Which of the four the card is drawing, and whether that one is a control.
    @ViewBuilder private var stated: some View {
        switch nextUp {
        case let .pick(pick): opener(pick)
        case .nothingUnblocked:
            tier("Nothing is unblocked. Every open leaf is waiting on something still open.")
        case .allRunning:
            tier("Everything takeable already has a Session running.")
        case .backlogClear:
            tier("The backlog is clear. Nothing is waiting to be picked up.")
        }
    }

    /// The pick, AS a control (#898). Pressing it opens the ticket in the deck's pane and moves
    /// nothing else — `NextUpIntents.open`.
    private func opener(_ pick: NextUp.Pick) -> some View {
        Button { intents.open(pick.number) } label: {
            card(picked(pick), opens: true)
        }
        .buttonStyle(NextUpCardStyle())
        // Named for the ACT and not just the ticket: this label is the whole of what a reader who
        // cannot see the chevron is told about pressing it.
        .accessibilityLabel("Next up, open ticket \(pick.number), \(pick.title)")
    }

    /// A degraded tier: a sentence, and never a control. It names no ticket, and a card that lit
    /// under the pointer to open nothing is worse than one that never moves.
    private func tier(_ words: String) -> some View {
        card(sentence(words), opens: false)
            .nextUpCardGround()
            .accessibilityElement(children: .combine)
    }

    /// The label, and what the card states under it. `opens` draws the chevron — the card's one
    /// mark AT REST that it is pressable, which the tiers must not carry.
    private func card(_ stated: some View, opens: Bool) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            HStack(spacing: ArgoSpacing.base) {
                GroupLabel("Next up")
                Spacer(minLength: ArgoSpacing.base)
                if opens {
                    ArgoGlyph(ArgoSymbol.disclosure, .chevron)
                        .foregroundStyle(argo.color.text.tertiary)
                }
            }
            stated
        }
    }

    private func picked(_ pick: NextUp.Pick) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                Text("#\(pick.number)")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
                Text(pick.title)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                    // A `List` row gives its content one line's height without the `fixedSize`.
                    .lineLimit(Self.titleLines)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !pick.reasons.isEmpty {
                chips(pick.reasons)
            }
        }
    }

    /// The design's `flex-wrap`, which the room already spells as a `Layout` (#815). Two chips fit
    /// one line at the default text size and break onto a second where the reader has scaled up.
    private func chips(_ reasons: [NextUp.Reason]) -> some View {
        WrapFlow(gap: ArgoSpacing.snug) {
            ForEach(reasons, id: \.words) { NextUpChip(reason: $0) }
        }
    }

    private func sentence(_ words: String) -> some View {
        Text(words)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.tertiary)
            // A `List` row truncates its content to one line without both.
            .lineLimit(nil)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview("Next-up hero — the four tiers") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        NextUpCard(nextUp: TicketsFixture.room.nextUp ?? .backlogClear)
        NextUpCard(nextUp: .nothingUnblocked)
        NextUpCard(nextUp: .allRunning)
        NextUpCard(nextUp: .backlogClear)
    }
    .frame(width: ArgoLayout.sidebarMinimumWidth)
    .argoAppearance()
}

#Preview("Next-up hero — one earned chip, and a title that wraps") {
    NextUpCard(nextUp: .pick(.init(
        number: 334,
        title: "The Route — a progress-axis view of a ticket and its children",
        reasons: [.highPriority],
    )))
    .frame(width: ArgoLayout.sidebarMinimumWidth)
    .argoAppearance()
}
