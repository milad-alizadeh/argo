import ArgoEngine
import SwiftUI

/// The composer New ticket opens: a title, a body, and the one act that files them (#872).
///
/// Two fields and no more. Everything else a provider carries — labels, priority, type, a parent —
/// is a per-provider affordance the port declares over (`WorkItemSurface`), and a field for one the
/// Binding cannot take would be a control that exists to be refused. The ticket is edited on the
/// provider after it is filed.
///
/// It renders the SAME `WriteControlState` the row's button does, off the same reading: a token
/// that died while the sheet was open disables `Create ticket` in place and points at the same
/// repair, rather than letting the sheet spend a write the row already knows is refused.
struct NewTicketComposer: View {
    @Environment(\.argo) private var argo

    @Binding var composition: TicketComposition
    var control = WriteControlState.live
    var reconnect: () -> Void = {}
    var cancel: () -> Void = {}
    var create: (WorkItemDraft) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text("New ticket")
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.top, ArgoSpacing.section)
            Form {
                Section {
                    TextField("Title", text: $composition.title)
                    TextField("Description", text: $composition.body, axis: .vertical)
                        .lineLimit(ArgoWorkChrome.composerBodyLines, reservesSpace: true)
                }
            }
            .formStyle(.grouped)
            call
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.section)
        }
        .frame(width: ArgoConnectPanel.width, alignment: .leading)
        // The panel is its CONTENT's height. A grouped `Form` is happy to take whatever it is
        // given, and without this the two buttons sit at the foot of the window rather than under
        // the fields they act on — which is what a render of it showed.
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Cancel, then the write. The note sits to their leading edge for the reason it does on the
    /// row: a line under the buttons would resize the sheet around them.
    private var call: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            if let reason = control.reason {
                WriteNote(
                    reason: reason,
                    reconnect: control.needsReconnect ? reconnect : nil,
                )
            }
            Spacer(minLength: ArgoSpacing.flush)
            Button("Cancel", action: cancel)
                .buttonStyle(.quiet)
                .keyboardShortcut(.cancelAction)
            Button("Create ticket") { composition.draft.map(create) }
                .argoText(ArgoTypography.control)
                .keyboardShortcut(.defaultAction)
                .disabled(composition.draft == nil || !control.isEnabled)
        }
    }
}

#Preview("New ticket composer") {
    @Previewable @State var composition = TicketComposition()

    NewTicketComposer(composition: $composition)
        .argoAppearance()
}

#Preview("New ticket composer — the token died while it was open") {
    @Previewable @State var composition = TicketComposition(
        title: "The Work room's row draws four verbs and performs none",
        body: "Every control in the row takes a click and returns.",
    )

    NewTicketComposer(composition: $composition, control: .blocked(ConnectFixture.personal))
        .argoAppearance()
}
