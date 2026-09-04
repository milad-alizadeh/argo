import ArgoDesign
import SwiftUI

/// What a mutation did, in lines: `+8 −3`, each half in its own diff ink and neither drawn at zero.
///
/// One call's patch and a whole stretch's aggregate are the same two numbers, so both are drawn
/// here — a second copy of the pair would let the card and the row it folds disagree.
struct FeedChurnMarks: View {
    @Environment(\.argo) private var argo

    let churn: FeedCall.Churn

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            if churn.added > 0 {
                Text("+\(churn.added, format: .machine)").foregroundStyle(argo.color.diff.added)
            }
            if churn.removed > 0 {
                Text("−\(churn.removed, format: .machine)").foregroundStyle(argo.color.diff.removed)
            }
        }
        .argoMono(.body)
        .monospacedDigit()
    }
}
