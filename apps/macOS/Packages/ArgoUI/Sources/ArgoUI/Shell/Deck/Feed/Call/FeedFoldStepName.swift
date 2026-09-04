import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One name in a fold's list, and the way into the pane beside it.
///
/// Set on the SAME rung as the count above it and as every other line of the feed — the list is
/// more of the reading, not a caption under it (#1228). A chevron on the trailing edge says where
/// the press lands: beside the reading, on that one call's own result and on nothing else.
///
/// A call the record answered with nothing is still listed — it happened — and is inert: no
/// chevron, no ground under the pointer, and the disabled ink. A call that FAILED keeps the
/// failure's ink whether or not it left anything behind, which is the answer a call row gives, so
/// the failure outranks the inert reading of the same name.
struct FeedFoldStepName: View {
    @Environment(\.argo) private var argo

    let step: FeedFoldStep
    /// Whether the panel is open on THIS name's result.
    let isCurrent: Bool
    /// Whether a still is asked to draw the pointer over this name — see
    /// `FeedFoldOpening.pointsAt`.
    let isPointedAt: Bool
    let look: (Int) -> Void

    @State private var isUnderPointer = false

    var body: some View {
        Button { step.goesTo.map(look) } label: {
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
                Text(step.caption)
                    .argoText(ArgoTypography.body)
                    .lineLimit(1)
                    .truncationMode(.head)
                repeats
                Spacer(minLength: ArgoFeedRow.callGap)
                chevron
            }
            .foregroundStyle(ink)
            // The mark's column let in first, so the name hangs under the header's WORDS rather
            // than under the run's mark — then the row's own ground around it, at the same step
            // the header stands at in both states, so a name and the count above it are the same
            // shape at the same height (#1354).
            .padding(.leading, ArgoFeedRow.foldNameIndent)
            .feedRowGround(ground)
        }
        .buttonStyle(.plain)
        .disabled(!goesSomewhere)
        .onHover { isUnderPointer = $0 }
        .argoAnimation(.selection, value: isUnderPointer)
        .accessibilityLabel(step.spoken)
        .accessibilityAddTraits(isCurrent ? [.isSelected] : [])
        .accessibilityHint(goesSomewhere ? "Shows what this call produced" : "")
    }

    /// How many calls this one name stands for. Without it the list would not add up to the counts
    /// on the line above, which are in calls (`FeedFold.listed`).
    @ViewBuilder private var repeats: some View {
        if step.repeats > 1 {
            Text("×\(step.repeats, format: .machine)")
                .argoMono(ArgoTypography.body.rung)
                .monospacedDigit()
        }
    }

    /// It points BESIDE and never turns: the header's chevron is the accordion's, and it is the
    /// only mark in the row that has a direction to change.
    @ViewBuilder private var chevron: some View {
        if goesSomewhere {
            ArgoDisclosure(.beside)
                .foregroundStyle(
                    isCurrent ? argo.color.interaction.accent : argo.color.text.disabled,
                )
        }
    }

    /// The same selected ground a feed row takes, so the name the panel is open on is marked by its
    /// GROUND and not by the ink of the word alone — which is all it carried before, and which a
    /// reader scanning ten names has to read one at a time to find.
    private var ground: ArgoColor {
        guard goesSomewhere else { return .transparent }
        if isCurrent {
            return argo.color.surface.selected
        }
        return isPointedAt || isUnderPointer ? argo.color.surface.hover : .transparent
    }

    private var ink: ArgoColor {
        if step.hasFailed {
            return argo.color.state.failure
        }
        guard goesSomewhere else { return argo.color.text.disabled }
        return isCurrent ? argo.color.interaction.accentBright : argo.color.text.tertiary
    }

    /// Whether there is anything behind this name to open.
    private var goesSomewhere: Bool {
        step.goesTo != nil
    }

    /// Spelled out: a `@State private` stored property makes the synthesised memberwise
    /// initializer private, and the list that draws these is in another file (#1085).
    init(step: FeedFoldStep, isCurrent: Bool, isPointedAt: Bool, look: @escaping (Int) -> Void) {
        self.step = step
        self.isCurrent = isCurrent
        self.isPointedAt = isPointedAt
        self.look = look
    }
}
