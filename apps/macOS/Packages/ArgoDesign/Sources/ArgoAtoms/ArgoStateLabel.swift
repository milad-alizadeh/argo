import ArgoDesign
import SwiftUI

/// A state said as a mark rather than as prose: the roster row's `NEEDS INPUT`, the Permission
/// prompt's `PERMISSION`.
///
/// Not `ArgoBadge`, which is a count on a control and takes no hue. This one is nothing but the
/// words, and the state it names is what colours it.
///
/// The case is applied here, so no caller can draw one in sentence case: `ArgoTypography.badge`
/// cannot carry it, because a role holds a font and a `Text` cannot be asked what case it was set
/// in.
///
/// Ink is the caller's — which ink a state takes is the state's to say.
public struct ArgoStateLabel: View {
    let word: String

    public init(word: String) {
        self.word = word
    }

    public var body: some View {
        Text(word)
            .argoText(ArgoTypography.badge)
            .textCase(.uppercase)
            .lineLimit(1)
    }
}

#Preview("State label — every word the shell says as one") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        ArgoStateLabel(word: "Needs input")
        ArgoStateLabel(word: "Stopped")
        ArgoStateLabel(word: "Permission")
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
