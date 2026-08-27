import ArgoEngine
import SwiftUI

/// The open ticket's own verbs, in one vessel: `Start` and the chevron that chooses the Mode it
/// starts in, then the two link verbs past a rule.
///
/// **A SPLIT control, not an ellipsis.** The button starts a Session; the chevron opens `ModeMenu`.
/// The two link verbs — open on the code host, copy link — are icons beside it rather than rows
/// inside it, because nothing in this room is behind an unlabelled control
/// (`cockpit-work-room.md`).
struct StartControl: View {
    @Environment(\.argo) private var argo

    let verbs: WorkToolbarIntents.Verbs
    @Binding var mode: SessionMode

    var body: some View {
        ToolbarVessel {
            start
            ModeMenu(mode: $mode)
            DeckSeparator()
                .frame(height: ArgoWorkToolbar.splitDividerHeight)
                .accessibilityHidden(true)
            ToolbarIcon(
                symbol: ArgoSymbol.openOnHost, label: "Open on host", act: verbs.openOnHost,
            )
            ToolbarIcon(symbol: ArgoSymbol.copyLink, label: "Copy link", act: verbs.copyLink)
        }
    }

    /// The one control on this row that spends a word. It is the verb the room exists for, and a
    /// bolt on its own would be the unlabelled mark the study cut.
    private var start: some View {
        Button(action: verbs.start) {
            HStack(spacing: ArgoSpacing.snug) {
                ArgoGlyph(ArgoSymbol.startSession, ArgoWorkToolbar.iconSize)
                Text("Start")
                    .argoText(ArgoTypography.control)
            }
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoWorkToolbar.iconButtonHeight)
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help("Start a Session on this ticket")
        .accessibilityLabel("Start a Session on this ticket")
    }
}

#Preview("Start control") {
    @Previewable @State var mode = SessionMode.code

    StartControl(verbs: .inert, mode: $mode)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
