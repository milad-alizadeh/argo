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
        sentence
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.tertiary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, ArgoSpacing.region)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    /// Named rather than set in the `body`, so a test can read the drawn line back and hold the
    /// number to its one spelling (#1263). `IssueReading.mark` arrives as a `String`, which a
    /// localized key substitutes verbatim: the sentence stays translatable and the number stays
    /// `#1261`.
    var sentence: Text {
        Text("Nothing has been read for \(IssueReading.mark(number)) yet.")
    }
}

#Preview("Ticket pane — a link to a number nothing was read for") {
    TicketUnread(number: 264)
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
