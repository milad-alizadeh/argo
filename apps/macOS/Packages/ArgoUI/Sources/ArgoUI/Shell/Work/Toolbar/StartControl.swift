import ArgoEngine
import SwiftUI

/// The open ticket's own verbs, in one vessel: `Start` and the chevron that chooses the Mode it
/// starts in, then the two link verbs past a rule.
///
/// **A SPLIT control, not an ellipsis.** The button starts a Session; the chevron opens `ModeMenu`.
/// The two link verbs — open on the code host, copy link — are icons beside it rather than rows
/// inside it, because nothing in this room is behind an unlabelled control
/// (`cockpit-work-room.md`).
///
/// The two link verbs DISABLE where the Binding cannot address the ticket in a browser (#872) —
/// drawn and unpressable, rather than live and inert. Disabled and not hidden: the row is a fixed
/// set of marks, and a pair that came and went with the provider would move the ones beside them.
struct StartControl: View {
    @Environment(\.argo) private var argo

    let verbs: WorkToolbarIntents.Verbs
    @Binding var mode: SessionMode

    var body: some View {
        ToolbarVessel {
            start
            ModeMenu(mode: $mode)
            DeckSeparator()
                .frame(height: ArgoWorkChrome.splitDividerHeight)
                .accessibilityHidden(true)
            ToolbarIcon(
                symbol: ArgoSymbol.openOnHost,
                label: "Open on host",
                act: verbs.openOnHost ?? {},
            )
            .disabled(verbs.openOnHost == nil)
            ToolbarIcon(
                symbol: ArgoSymbol.copyLink, label: "Copy link", act: verbs.copyLink ?? {},
            )
            .disabled(verbs.copyLink == nil)
        }
    }

    /// The one control on this row that spends a word. It is the verb the room exists for, and a
    /// glyph on its own would be the unlabelled mark the study cut.
    private var start: some View {
        Button(action: verbs.start) {
            HStack(spacing: ArgoSpacing.snug) {
                ArgoGlyph(ArgoSymbol.startSession, ArgoWorkChrome.iconSize)
                Text("Start")
                    .argoText(ArgoTypography.control)
            }
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoWorkChrome.iconButtonHeight)
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
