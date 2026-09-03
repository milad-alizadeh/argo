import SwiftUI

/// The backlog a Session can be attached to, and the way back out of an attachment (#1092) — the
/// menu content both shapes of `SessionIssueLink` present, so the linked row's secondary click and
/// the unlinked row's press can never offer two lists.
///
/// A `View` taking its data as a parameter rather than a `@ViewBuilder` on the caller
/// (`rules/swift.md` — Views): the offering is what this draws, so it is what it takes.
struct SessionTicketPicker: View {
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
