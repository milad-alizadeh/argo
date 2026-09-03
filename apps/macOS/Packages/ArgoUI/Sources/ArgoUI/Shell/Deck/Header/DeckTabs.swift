import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The tab line's tabs, on its leading edge behind the Ticket link (#404;
/// `cockpit-session-header.md`). Plain text tabs under an Ion rule — deliberately not a segmented
/// `Picker`: #378 rules out a pill or a glass control on this plane, and the selected edge is the
/// same rule the sidebar spends on a selected row.
///
/// Bottom-aligned to the line's own edge, so the rule sits against the pane it names rather than
/// floating in the middle of 40 points of chrome.
///
/// Each tab is a Button and each is its own focus stop, which is what puts the keyboard into this
/// zone at all — the criterion #404 has left. No arrow-key movement across the strip: with one
/// pane drawn there is nowhere to arrow TO, and a key that answers nothing is worse than a key
/// that was never claimed.
struct DeckTabs: View {
    @Environment(\.argo) private var argo
    /// Whether the strip starts with the keyboard on its selected tab — a specimen's seam, since a
    /// Tab press cannot be reached from a screenshot. In the environment because four views
    /// separate a specimen from this one, and none of them has an opinion about the keyboard. It
    /// draws no ring alone: `ArgoFocusVisibility` still has to say the reader arrived by key.
    @Environment(\.argoDeckTabsCursored) private var isCursored

    @Binding var selection: DeckTab

    @FocusState private var focused: DeckTab?

    var body: some View {
        HStack(alignment: .bottom, spacing: ArgoSpacing.loose) {
            ForEach(DeckTab.shown) { tab in
                view(for: tab)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .argoAnimation(.selection, value: selection)
        .onAppear {
            if isCursored {
                focused = selection
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func view(for tab: DeckTab) -> some View {
        // The label is hidden from accessibility and the name worn by the Button's own frame:
        // collapsing the pair into a group would take the Button's element with it, and with it
        // the press a screen reader offers and the Tab stop macOS does (#777, as on `PlanPill`).
        Button { selection = tab } label: {
            Text(tab.title)
                .argoText(ArgoTypography.control)
                .foregroundStyle(ink(for: tab))
                .lineLimit(1)
                // The ring is around the WORD, not around the 40pt stop it is centred in: a
                // focusable is routinely a larger box than the thing focused (#533).
                .argoFocusRing(
                    focused == tab,
                    in: RoundedRectangle(cornerRadius: ArgoRadius.marker),
                )
                // The stop fills the line, so the rule below lands on the line's own edge rather
                // than floating a word's height above it.
                .frame(maxHeight: .infinity)
                .accessibilityHidden(true)
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($focused, equals: tab)
        .focusEffectDisabled()
        // `.focusable()` above takes the key events a focused Button would answer itself.
        .argoPressedByKey { selection = tab }
        .overlay(alignment: .bottom) { rule(under: tab) }
        .accessibilityLabel(tab.title)
        // Selected only: the Button publishes its own press.
        .accessibilityAddTraits(selection == tab ? .isSelected : [])
    }

    @ViewBuilder private func rule(under tab: DeckTab) -> some View {
        if selection == tab {
            Rectangle()
                .fill(argo.color.interaction.selectionIndicator)
                .frame(height: ArgoStroke.indicator)
        }
    }

    /// The unselected tab stays a word rather than dimming to a disabled one: it is pressable, and
    /// the rule under its neighbour is what says which pane is open.
    private func ink(for tab: DeckTab) -> ArgoColor {
        selection == tab ? argo.color.text.primary : argo.color.text.tertiary
    }
}

package extension EnvironmentValues {
    /// Whether the keyboard starts on the deck's tabs. A specimen's seam and nothing else: the
    /// reader's own Tab press moves focus without it.
    @Entry var argoDeckTabsCursored: Bool = false
}

#Preview("Deck tabs — the drawn tab, selected") {
    @Previewable @State var selection = DeckTab.opening

    DeckTabs(selection: $selection)
        .padding(.horizontal, ArgoSpacing.section)
        .frame(width: 420, height: ArgoLayout.deckTabSlotHeight)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Deck tabs — the keyboard on the strip") {
    @Previewable @State var selection = DeckTab.opening

    DeckTabs(selection: $selection)
        .environment(\.argoDeckTabsCursored, true)
        .padding(.horizontal, ArgoSpacing.section)
        .frame(width: 420, height: ArgoLayout.deckTabSlotHeight)
        .argoDeckSurface()
        .argoAppearance()
}
