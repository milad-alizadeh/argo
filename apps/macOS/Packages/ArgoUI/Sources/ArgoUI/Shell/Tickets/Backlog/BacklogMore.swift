import ArgoEngine
import SwiftUI

/// The foot of the closed list: there is another page, and this is what reads it (#1075).
///
/// It is drawn ONLY where the provider served a cursor, which is the whole bound made visible — a
/// row that stayed on screen after the last page would be the control-that-does-nothing this room
/// keeps refusing (#900). It says how many it will read, because a reader deciding whether to press
/// it is deciding how long to wait.
struct BacklogMore: View {
    @Environment(\.argo) private var argo

    let read: @MainActor () -> Void

    var body: some View {
        Button(action: read) {
            Text("Load \(ClosedTicketPage.size) more")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.secondary)
                .frame(maxWidth: .infinity, minHeight: ArgoBacklogList.rowHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Load \(ClosedTicketPage.size) more closed tickets")
    }
}

#Preview("Backlog — another page of closed tickets behind this one") {
    BacklogMore(read: {})
        .frame(width: ArgoBacklogList.width)
        .argoDeckSurface()
        .argoAppearance()
}
