import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A bounded glass capsule on the Tickets room's toolbar — the row's unit of grouping.
///
/// **No border and no drop shadow**, which `argoFloatingGlass` already spells:
/// `ArgoElevation.vessel` is zero on all three axes because the specular rim IS the depth cue, so
/// a hairline would stack a second edge on the one the material already draws.
struct ToolbarVessel<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: ArgoTicketsChrome.vesselGap) {
            content
        }
        .padding(ArgoTicketsChrome.vesselInset)
        .argoFloatingGlass(in: .capsule)
    }
}

/// One glyph in a vessel: the whole of what a toolbar button draws.
struct ToolbarIcon: View {
    @Environment(\.argo) private var argo
    /// `.buttonStyle(.plain)` over an explicit `foregroundStyle` dims for nobody, so a control
    /// disabled in place picks its own ink (#275).
    @Environment(\.isEnabled) private var isEnabled

    let symbol: String
    /// What the mark means, said in words for the pointer and for VoiceOver. One string, because a
    /// tooltip and a label that disagree are two claims about one control.
    let label: String
    /// No default. A mark drawn over `{}` looks live and is not, which is what #900 shipped — so
    /// the act is written at every call site, including a preview's.
    let act: () -> Void

    var body: some View {
        Button(action: act) {
            ArgoGlyph(symbol, ArgoTicketsChrome.iconSize)
                .foregroundStyle(isEnabled ? argo.color.text.tertiary : argo.color.text.disabled)
                .frame(
                    width: ArgoTicketsChrome.iconButtonWidth,
                    height: ArgoTicketsChrome.iconButtonHeight,
                )
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
    }
}

#Preview("Toolbar vessels — one mark, and marks sharing a capsule past a rule") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.newTicket, label: "New ticket", act: {})
        }
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.openOnHost, label: "Open on host", act: {})
            DeckSeparator()
                .frame(height: ArgoTicketsChrome.splitDividerHeight)
                .accessibilityHidden(true)
            ToolbarIcon(symbol: ArgoSymbol.copyLink, label: "Copy link", act: {})
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
