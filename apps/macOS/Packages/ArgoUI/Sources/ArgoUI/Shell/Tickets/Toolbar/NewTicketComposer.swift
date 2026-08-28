import ArgoEngine
import SwiftUI

/// The composer New ticket opens: a title, a body, and the one act that files them (#872).
///
/// Two fields and no more. Everything else a provider carries — labels, priority, type, a parent —
/// is a per-provider affordance the port declares over (`TicketSurface`), and a field for one the
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
    var create: (TicketDraft) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            Text("New ticket")
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
            fields
            call
        }
        .padding(ArgoSpacing.section)
        .frame(width: ArgoConnectPanel.width, alignment: .leading)
        // The panel is its CONTENT's height, rather than whatever the sheet is given: without this
        // the two buttons sit at the foot of the window rather than under the fields they act on —
        // which is what a render of it showed.
        .fixedSize(horizontal: false, vertical: true)
    }

    /// The two fields, each under its own name (#891).
    ///
    /// No `Form`: macOS's grouped form style promotes a field's placeholder to a leading label and
    /// sets the value trailing, which made this the one place in the cockpit a value was read from
    /// the right.
    private var fields: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
            field("Title") { TextField("", text: $composition.title) }
            field("Description") {
                TextField("", text: $composition.body, axis: .vertical)
                    .lineLimit(ArgoTicketsChrome.composerBodyLines, reservesSpace: true)
            }
        }
    }

    /// One name over what it names, both on the sheet's own leading edge. The name is drawn rather
    /// than passed as the field's own label, so it carries the cockpit's `GroupLabel` and not the
    /// platform's; the field keeps it for VoiceOver.
    private func field(_ name: String, @ViewBuilder editor: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            GroupLabel(name)
            editor()
                .multilineTextAlignment(.leading)
                .accessibilityLabel(name)
        }
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
        title: "The Tickets room's row draws four verbs and performs none",
        body: "Every control in the row takes a click and returns.",
    )

    NewTicketComposer(composition: $composition, control: .blocked(ConnectFixture.personal))
        .argoAppearance()
}
