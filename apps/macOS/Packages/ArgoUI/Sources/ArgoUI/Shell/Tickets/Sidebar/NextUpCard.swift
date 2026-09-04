import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The hero at the foot of the sidebar's scroll, answering "what should I pick up"
/// (`cockpit-work-room.md` — the Next-up hero).
///
/// Inset, on `surface.raised`, behind an `edge.subtle` border — three things a `ViewRow` has none
/// of, which is what stops it reading as another view.
///
/// A CONTROL where it names a ticket (#898). A `Button` and not a row of the `List` it scrolls in:
/// the arrow keys belong to the four views, and the hero is not a fifth (`TicketsSidebar.hero`).
///
/// TWO controls since #899: the card opens the ticket, and the starter at its foot starts a Session
/// on it. They are siblings rather than one nested in the other — see `opener(_:)`.
package struct NextUpCard: View {
    @Environment(\.argo) private var argo

    /// The card states one ticket, so its title wraps to the rail's width rather than truncating.
    /// Three is where the longest real title in the backlog sets at 280.
    static let titleLines = 3

    let nextUp: NextUp
    /// What pressing it does (#898), inert for a `#Preview` and a specimen.
    var intents = NextUpIntents.inert

    package var body: some View {
        statement
            // Vertical only: the card's left and right are the rail's `railInset`, the vertical
            // the marks and the counts beside it are read down.
            .padding(.top, ArgoTicketsSidebar.heroTopInset)
            .padding(.bottom, ArgoTicketsSidebar.heroFootInset)
    }

    /// Which of the four tiers the card states, and whether that one is a control.
    @ViewBuilder private var statement: some View {
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

    /// The pick, AS a control — `NextUpIntents.open` — carrying the second verb over it.
    ///
    /// The starter is drawn twice on purpose: `picked(_:)` holds a hidden one so the card is laid
    /// out around it, and the live one is an OVERLAY, which is what makes it hittable. Nesting it
    /// in the label would draw a control the card's own Button swallows every click of
    /// (`NextUpStarter`). Both are inset by `heroPadding`, so the two land in one place.
    private func opener(_ pick: NextUp.Pick) -> some View {
        Button { intents.open(pick.number) } label: {
            card(picked(pick), opens: true)
        }
        .buttonStyle(NextUpCardStyle())
        .accessibilityLabel(spoken(pick))
        .overlay(alignment: .bottomTrailing) {
            starter(pick)
                .padding(ArgoTicketsSidebar.heroPadding)
        }
    }

    private func starter(_ pick: NextUp.Pick) -> some View {
        NextUpStarter(command: intents.starting.command(pick.number)) {
            intents.starting.run(pick.number)
        }
    }

    /// The act, the ticket, and the chips — everything the card draws. Named for the ACT because
    /// this string is the whole of what a reader who cannot see the chevron is told, and it carries
    /// the chips because the reasons are half of why this ticket is the one being offered.
    private func spoken(_ pick: NextUp.Pick) -> String {
        (["Next up, open ticket \(pick.number), \(pick.title)"] + pick.reasons.map(\.words))
            .joined(separator: ", ")
    }

    /// A degraded tier: a sentence, and never a control — it names no ticket to open.
    private func tier(_ words: String) -> some View {
        card(sentence(words), opens: false)
            .nextUpCardGround()
            .accessibilityElement(children: .combine)
    }

    /// The label, and what the card states under it. `opens` draws the chevron — the card's one
    /// mark AT REST that it is pressable, which the tiers must not carry.
    private func card(_ statement: some View, opens: Bool) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            HStack(spacing: ArgoSpacing.base) {
                GroupLabel("Next up")
                Spacer(minLength: ArgoSpacing.base)
                if opens {
                    ArgoGlyph(ArgoSymbol.disclosure, .chevron)
                        .foregroundStyle(argo.color.text.tertiary)
                }
            }
            statement
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
            // The space the overlaid starter lands on. Hidden and not absent: `hidden()` keeps a
            // view in the layout, which is the whole reason the two agree without a measurement.
            starter(pick)
                .hidden()
                .frame(maxWidth: .infinity, alignment: .trailing)
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(nextUp: NextUp, intents: NextUpIntents = NextUpIntents.inert) {
        self.nextUp = nextUp
        self.intents = intents
    }
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
