import ArgoDesign
import SwiftUI

/// What you are looking at and how many, over the list it counts — **inside the pane, under that
/// pane's own header band** (#836, #1242).
///
/// **Two lines, and the second is not decoration.** A title without its count can lie about what
/// you are filtered to: `Backlog` alone reads the same over twelve tickets and over the four that
/// survived a filter. Mail's own band says `Inbox — …` over `All Mail · 290 messages, 149 unread`
/// for this reason.
///
/// **Words only.** The controls that narrow this list are on the band above it — New ticket at the
/// pane's leading edge, the search field at its trailing one — so a control sits over the pane it
/// acts on and this says only what the list IS (`TicketsPaneHeader`, #1242).
package struct BacklogHeader: View {
    @Environment(\.argo) private var argo

    package let reading: TicketsChromeProjection.Reading

    package var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            lines
            Spacer(minLength: ArgoSpacing.base)
        }
        .padding(.horizontal, ArgoBacklogList.bandInsetX)
        .frame(minHeight: ArgoBacklogList.bandHeight)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(reading.heading), \(reading.subtitle)")
    }

    private var lines: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text(reading.heading)
                .argoText(ArgoTypography.windowTitle)
                .foregroundStyle(argo.color.text.primary)
            Text(reading.subtitle)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .accessibilityHidden(true)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(reading: TicketsChromeProjection.Reading) {
        self.reading = reading
    }
}

// The vacancy: the provider answered with nothing, so the count says zero and the two controls that
// narrow a list are gone with the list.
