import SwiftUI

/// A bounded glass capsule on the Work room's toolbar — the row's unit of grouping.
///
/// **No border and no drop shadow.** `ArgoElevation.vessel` is zero on all three axes because the
/// specular rim IS the depth cue, so a hairline here would stack a second edge on the one the
/// material already draws (`cockpit-work-room.md` — Liquid Glass, one material, every vessel).
/// `argoFloatingGlass` is what spells that once; this is only the shape and the inset.
struct ToolbarVessel<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: ArgoWorkToolbar.vesselGap) {
            content
        }
        .padding(ArgoWorkToolbar.vesselInset)
        // A capsule is a SHAPE, not a radius — no rung of `ArgoRadius` applies, and a rounded
        // rectangle beside the toolbar's own stadiums reads as a different kind of control.
        .argoFloatingGlass(in: .capsule)
    }
}

/// One glyph in a vessel: the whole of what a toolbar button draws.
///
/// A word is never drawn here. Every control in this room is labelled — the mark carries the
/// tooltip and the VoiceOver label, and `StartControl` is the one that spends a word, because it is
/// the verb the room is for.
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
