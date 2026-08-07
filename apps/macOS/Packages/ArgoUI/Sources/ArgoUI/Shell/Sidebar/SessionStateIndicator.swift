import SwiftUI

/// The canonical state dot. It leads every roster row, including the rows whose state Argo
/// cannot establish: an outlined dot holds the column so titles stay on one x, and reads as
/// the honest `unknown` the tier rules owe rather than as a quiet `idle`.
struct SessionStateIndicator: View {
    @Environment(\.argo) private var argo

    let state: ArgoOperationalState?

    var body: some View {
        Group {
            if let state {
                Circle().fill(state.tint(in: argo.color))
            } else {
                Circle().strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
            }
        }
        .frame(width: ArgoLayout.statusDotSize, height: ArgoLayout.statusDotSize)
        .accessibilityHidden(true)
    }
}
