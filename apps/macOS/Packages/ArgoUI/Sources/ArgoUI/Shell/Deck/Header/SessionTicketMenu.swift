import SwiftUI

/// The way back out of an attachment, and the way to move one (#1092) — the secondary click on a
/// Session that is already on a Ticket.
///
/// A platform menu and not `SessionTicketPicker`: this hangs off a `contextMenu`, which can hold
/// menu items and nothing else. The picker's own searching field is the UNLINKED row's press
/// (#1231), where the reader has the whole backlog to find one in; here they already have a
/// Ticket, and what they came for is Unlink.
struct SessionTicketMenu: View {
    let linking: SessionTicketLinking

    var body: some View {
        ForEach(linking.options) { option in
            Button(option.label) { linking.link(option.number) }
        }
        // Only ever over a pin: a derived link is not the reader's to take back, and an Unlink
        // beside one would offer to undo a branch name.
        if linking.pinned != nil {
            Divider()
            Button("Unlink from this Ticket") { linking.link(nil) }
        }
    }
}
