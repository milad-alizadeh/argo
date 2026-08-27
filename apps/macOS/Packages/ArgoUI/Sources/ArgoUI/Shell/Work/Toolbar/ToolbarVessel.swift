import SwiftUI

/// A bounded glass capsule on the Work room's toolbar — the row's unit of grouping.
///
/// **No border and no drop shadow**, which `argoFloatingGlass` already spells:
/// `ArgoElevation.vessel` is zero on all three axes because the specular rim IS the depth cue, so
/// a hairline would stack a second edge on the one the material already draws.
struct ToolbarVessel<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: ArgoWorkToolbar.vesselGap) {
            content
        }
        .padding(ArgoWorkToolbar.vesselInset)
        .argoFloatingGlass(in: .capsule)
    }
}

/// One glyph in a vessel: the whole of what a toolbar button draws.
struct ToolbarIcon: View {
    @Environment(\.argo) private var argo

    let symbol: String
    /// What the mark means, said in words for the pointer and for VoiceOver. One string, because a
    /// tooltip and a label that disagree are two claims about one control.
    let label: String
    var act: () -> Void = {}

    var body: some View {
        Button(action: act) {
            ArgoGlyph(symbol, ArgoWorkToolbar.iconSize)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(
                    width: ArgoWorkToolbar.iconButtonWidth,
                    height: ArgoWorkToolbar.iconButtonHeight,
                )
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
    }
}

#Preview("Toolbar vessels — one mark, and two sharing a capsule") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.newSession, label: "New ticket")
        }
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.filterBacklog, label: "Filter")
            ToolbarIcon(symbol: ArgoSymbol.groupBacklog, label: "Group by")
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
