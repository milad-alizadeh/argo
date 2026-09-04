import ArgoDesign
import ArgoEngine
import SwiftUI

/// The ticket's number, AS the link out to the code host (#1242).
///
/// This is what the window's two link verbs were deleted in favour of. They were a pair of vessels
/// re-deriving one address, parked at the far end of a row, addressing a ticket the reader had to
/// remember was open. The number is already on screen, already names the ticket, and is already
/// where a reader looks to say which one this is — so it carries the address instead.
///
/// **It draws as an inert label wherever the Binding cannot address the ticket.** A Linear Binding
/// holds a team id, and no page is derivable from one (`TicketAddress`), so there is nothing to
/// open. That is #872's rule kept: absent behaviour reaches the control as absence, and a control
/// that cannot act does not draw as though it can.
struct TicketNumberLink: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoTicketAddress) private var address
    @Environment(\.openURL) private var openURL

    let number: Int

    @State private var isPointedAt = false

    var body: some View {
        if let url = address?.browseURL(of: number) {
            Button { openURL(url) } label: { word(in: argo.color.interaction.accent) }
                .buttonStyle(.plain)
                .pointerStyle(.link)
                .onHover { isPointedAt = $0 }
                .help("Open \(IssueReading.mark(number)) on the code host")
                .accessibilityLabel("Open ticket \(number) on the code host")
                .contextMenu {
                    Button("Copy link") { ArgoPasteboard.put(url.absoluteString) }
                }
        } else {
            word(in: argo.color.text.tertiary)
        }
    }

    /// `IssueReading.mark` and not an interpolation: a ticket number is an identifier, not a
    /// quantity, and every surface that draws one asks the same speller (#1263).
    private func word(in ink: ArgoColor) -> some View {
        Text(IssueReading.mark(number))
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(ink)
            .underline(isPointedAt)
    }
}

package extension EnvironmentValues {
    /// How this Project's Ticket Binding addresses a ticket on its host, and `nil` where it cannot
    /// (#1242). In the environment rather than threaded down: the only thing that wants it is the
    /// number at the top of the ticket pane, and carrying it through `TicketsRoom`, `TicketDetail`
    /// and `TicketHead` would spend a parameter at each stop — three of which already sit at the
    /// initializer cap.
    @Entry var argoTicketAddress: TicketAddress?
}
