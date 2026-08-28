import ArgoEngine
import SwiftUI

/// The provider's own status word, and Argo's bucket behind a short rule only where the bucket is
/// not that same word (#272, #893) — on GitHub, `state` IS `open`.
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
            if let filing = filingWorthDrawing {
                ArgoRule(ink: argo.color.edge.subtle)
                    .frame(height: ArgoTicketDetail.statusDividerHeight)
                Text(filing)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.disabled)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(filingWorthDrawing.map { "\(word), filed under \($0)" } ?? word)
    }

    /// Named apart from `TicketState.filing`, which is the same word unconditionally.
    private var filingWorthDrawing: String? {
        bucket.filing(beside: word)
    }
}

#Preview("Status pair — every reading a provider can put in the head") {
    StatusPairSpecimen()
        .argoAppearance()
}
