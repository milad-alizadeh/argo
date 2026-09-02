import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The transient chip a degraded connection uses. It states the condition in words with the
/// dot beside them — never a bare coloured pill, which would ask the eye to remember what a
/// colour means.
struct SpecimenStatusChip: View {
    @Environment(\.argo) private var argo

    let state: ArgoOperationalState
    let label: String

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            SpecimenStateDot(state: state)
            Text(label).argoText(ArgoTypography.caption)
        }
        .foregroundStyle(state.tint(in: argo.color))
        .padding(.horizontal, ArgoSpacing.base)
        .padding(.vertical, 3)
        .background {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(state.ground(in: argo.color))
        }
        .accessibilityElement(children: .combine)
    }
}

/// The dot never carries the meaning alone — it follows the word.
struct SpecimenStateDot: View {
    @Environment(\.argo) private var argo

    let state: ArgoOperationalState

    var body: some View {
        Circle()
            .fill(state.tint(in: argo.color))
            .frame(width: 6, height: 6)
            .argoAnimation(.stateChange, value: state)
            .accessibilityHidden(true)
    }
}
