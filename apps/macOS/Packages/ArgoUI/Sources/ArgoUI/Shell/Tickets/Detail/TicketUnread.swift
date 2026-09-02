import ArgoDesign
import SwiftUI

/// What the ticket pane says where a link named a number nothing has been read for (#895).
///
/// It stands while the read is in flight AND after one that came back with nothing: both are Argo
/// having nothing to show, and nothing here can tell them apart.
struct TicketUnread: View {
    @Environment(\.argo) private var argo

    let number: Int

    var body: some View {
        Text("Nothing has been read for #\(number, format: .number.grouping(.never)) yet.")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.tertiary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, ArgoSpacing.region)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

#Preview("Ticket pane — a link to a number nothing was read for") {
    TicketUnread(number: 264)
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
