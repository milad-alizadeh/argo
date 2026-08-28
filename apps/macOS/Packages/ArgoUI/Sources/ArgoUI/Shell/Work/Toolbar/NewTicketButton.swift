import SwiftUI

/// The compose call-to-action, in a vessel of its own at the leading edge of the row — Mail's
/// compose button, in Mail's place and wearing Mail's mark (#836). It is the ONE thing this window
/// creates, which is what earns the compose mark: New Session is not in the Work room's row.
///
/// It SURVIVES the empty backlog where the vessel beside it does not, so the two cannot share one.
///
/// It is also the room's one provider-port write control, so §4 and §7 of the failure spec decide
/// its state: never hidden, disabled in place while a create is on the wire or the token is dead,
/// and untouched by mere staleness.
struct NewTicketButton: View {
    var creation = WorkToolbarIntents.Creation()

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            ToolbarVessel {
                ToolbarIcon(symbol: ArgoSymbol.newTicket, label: "New ticket", act: creation.act)
            }
            .disabled(!creation.control.isEnabled)
            // Beside the vessel, so the vessel's own geometry is untouched by either disabling or
            // failing — the whole of "in place, no layout shift".
            if let reason = creation.control.reason {
                WriteNote(
                    reason: reason,
                    reconnect: creation.control.needsReconnect ? creation.reconnect : nil,
                )
            }
        }
    }
}

#Preview("New ticket button") {
    NewTicketButton()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

// Every state past `live`, off the same list the specimens render.
#Preview("New ticket button — pending, refused, and no usable token") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        ForEach(WriteControlSpecimen.states, id: \.name) { state in
            NewTicketButton(
                creation: WorkToolbarIntents.Creation(control: state.control, reconnect: {}),
            )
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
