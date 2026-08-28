import ArgoEngine
import SwiftUI

/// The compose call-to-action, in a vessel of its own at the leading edge of the row — Mail's
/// compose button, in Mail's place and wearing Mail's mark (#836). It is the ONE thing this window
/// creates, which is what earns the compose mark: New Session is not in the Work room's row.
///
/// It SURVIVES the empty backlog where the vessel beside it does not, so the two cannot share one.
///
/// It is also the room's one **provider-port write** control, which is what the state does here:
/// disabled in place while a create is on the wire, disabled with the Account named when there is
/// no usable token, and left alone by mere staleness (#275 §4, §7).
struct NewTicketButton: View {
    var creation = WorkToolbarIntents.Creation()

    var body: some View {
        if creation.control.isDrawn {
            HStack(spacing: ArgoSpacing.comfortable) {
                ToolbarVessel {
                    ToolbarIcon(
                        symbol: ArgoSymbol.newTicket, label: "New ticket", act: creation.act,
                    )
                }
                .disabled(!creation.control.isEnabled)
                // Beside the vessel and not under it: the vessel's own geometry is untouched by
                // either disabling or failing, which is the whole of "in place, no layout shift".
                if let reason = creation.control.reason {
                    WriteNote(reason: reason)
                }
            }
        }
    }
}

#Preview("New ticket button") {
    NewTicketButton()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

// The three states the write control has beyond `live`, in the order a reader meets them: a create
// on the wire, one the provider refused in its own words, and a token that has to be re-granted
// before the button means anything.
#Preview("New ticket button — pending, refused, and no usable token") {
    let account = AccountRecord(
        provider: .github, providerAccountID: "1", displayName: "milad-alizadeh",
    )

    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        NewTicketButton(creation: WorkToolbarIntents.Creation(control: .pending))
        NewTicketButton(
            creation: WorkToolbarIntents.Creation(
                control: .refused(.refused("Issues are disabled for this repository.")),
            ),
        )
        NewTicketButton(creation: WorkToolbarIntents.Creation(control: .blocked(account)))
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
