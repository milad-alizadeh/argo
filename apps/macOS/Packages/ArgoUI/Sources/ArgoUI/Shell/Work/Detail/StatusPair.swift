import ArgoEngine
import SwiftUI

/// The provider's own status word and Argo's bucket, on one line behind a short rule. Neither is
/// shown in place of the other (#272): the word is the provider's and renders verbatim, the bucket
/// is what Argo computes across providers with, and the pair reads as a label and its filing rather
/// than as two competing claims.
///
/// The bucket is set LOWERCASE — uppercase machine at 11 reads as loud as the word it is filing
/// (`cockpit-work-room.md`, token reconciliation).
struct StatusPair: View {
    @Environment(\.argo) private var argo

    let word: String
    let bucket: TicketState

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Text(word)
                .argoText(ArgoTypography.rowMeta)
            ArgoRule(ink: argo.color.edge.subtle)
                .frame(height: ArgoTicketDetail.statusDividerHeight)
            Text(bucket.filing)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(word), filed under \(bucket.filing)")
    }
}

#Preview("Status pair — every bucket a word can be filed under") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        ForEach(TicketState.allCases, id: \.self) { StatusPair(word: "Todo", bucket: $0) }
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
