import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The header of the roster's archive: `Archived (n)`, and one chevron saying which way it is. The
/// whole row is the control (`docs/designs/cockpit-roster-archive-foot.md`).
struct RosterArchiveFoot: View {
    /// The chevron's own column, fixed so the label's leading edge holds still across the rotation.
    private static let gutter: CGFloat = ArgoSpacing.comfortable

    @Environment(\.argo) private var argo

    let foot: SessionRosterProjection.Foot
    /// A value, not a binding: the roster answers what "open" means, for the rows and the chevron
    /// alike.
    let isShowing: Bool
    let toggle: () -> Void
    /// Draws the pointer state without a pointer, for the render harness.
    var isPointedAt = false

    @State private var isPointerInside = false

    var body: some View {
        Button(action: toggle) { row }
            .buttonStyle(.plain)
            .onHover { isPointerInside = $0 }
            // Padding OUTSIDE the button, so the gap above the foot answers no clicks.
            .padding(.top, ArgoSpacing.base)
            .accessibilityLabel(foot.announcement)
            .accessibilityValue(isShowing ? "Expanded" : "Collapsed")
            .accessibilityHint("Shows the Sessions you archived")
    }

    private var row: some View {
        HStack(spacing: ArgoSpacing.snug) {
            chevron
            Text(foot.label)
                .argoText(ArgoTypography.caption)
            Spacer(minLength: ArgoSpacing.flush)
        }
        // The only hover feedback there is: the sidebar's material owns the row grounds (D2, D3),
        // so a wash here would read as a selection.
        .foregroundStyle(isLit ? argo.color.text.secondary : argo.color.text.tertiary)
        .padding(.vertical, ArgoSpacing.tight)
        .frame(minHeight: ArgoRosterFoot.minimumHeight)
        .contentShape(.rect)
        .argoAnimation(.stateChange, value: isLit)
    }

    private var isLit: Bool {
        isPointedAt || isPointerInside
    }

    /// The contract's chevron, turned by what it opens onto — the angle is what reports the state.
    private var chevron: some View {
        ArgoDisclosure(isShowing ? .below : .beside)
            .frame(width: Self.gutter, alignment: .leading)
    }
}

#Preview("Archive foot — shut, open, and under the pointer") {
    let foot = SessionRosterProjection.Foot(
        label: "Archived (2)", announcement: "Archived, 2 Sessions",
    )

    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        RosterArchiveFoot(foot: foot, isShowing: false, toggle: {})
        RosterArchiveFoot(foot: foot, isShowing: true, toggle: {})
        RosterArchiveFoot(foot: foot, isShowing: false, toggle: {}, isPointedAt: true)
    }
    .padding(ArgoSpacing.loose)
    .frame(width: 280)
    .argoAppearance()
}
