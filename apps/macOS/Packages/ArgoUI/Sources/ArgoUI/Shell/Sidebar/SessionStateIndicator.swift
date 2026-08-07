import SwiftUI

struct SessionStateIndicator: View {
    @Environment(\.argo) private var argo

    let state: ArgoOperationalState

    var body: some View {
        Circle()
            .fill(state.tint(in: argo.color))
            .frame(width: ArgoLayout.statusDotSize, height: ArgoLayout.statusDotSize)
            .accessibilityHidden(true)
    }
}
