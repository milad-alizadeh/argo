import SwiftUI

/// The header of the roster's archive: `Archived (n)`, and one chevron saying which way it is. The
/// whole row is the control (`docs/designs/cockpit-roster-archive-foot.md`).
struct RosterArchiveFoot: View {
    /// The chevron's own column, fixed so the label's leading edge holds still across the rotation.
    private static let gutter: CGFloat = ArgoSpacing.comfortable

    @Environment(\.argo) private var argo

    let label: String
    /// The same fact in words, because a screen reader reads `(2)` as punctuation.
    let announcement: String
    /// A value, not a binding: what "open" means is the roster's answer, and a control that wrote
    /// its own copy of it could draw an angle the rows below disagree with.
    let isShowing: Bool
    let toggle: () -> Void
    /// Draws the pointer state without a pointer, for the render harness — hover is the only ink
    /// change there is here, and a state with no render is one nobody has looked at.
    var isPointedAtForRender = false

    @State private var isPointedAt = false

    var body: some View {
        Button(action: toggle) { row }
            .buttonStyle(.plain)
            .onHover { isPointedAt = $0 }
            // The gap is padding OUTSIDE the button, so what separates the foot from the last kept
            // row is not also a strip of it that answers clicks.
            .padding(.top, ArgoSpacing.base)
            .accessibilityLabel(announcement)
            .accessibilityValue(isShowing ? "Expanded" : "Collapsed")
            .accessibilityHint("Shows the Sessions you archived")
    }

    private var row: some View {
        HStack(spacing: ArgoSpacing.snug) {
            chevron
            Text(label)
                .argoText(ArgoTypography.caption)
            Spacer(minLength: ArgoSpacing.flush)
        }
        // The only hover feedback there is: the sidebar's system material owns the row grounds
        // (D2, D3), so a wash here would read as a selection.
        .foregroundStyle(isLit ? argo.color.text.secondary : argo.color.text.tertiary)
        .padding(.vertical, ArgoSpacing.tight)
        .frame(minHeight: ArgoLayout.rosterFootMinimumHeight)
        .contentShape(.rect)
        .argoAnimation(.stateChange, value: isLit)
    }

    private var isLit: Bool {
        isPointedAt || isPointedAtForRender
    }

    /// The contract's chevron, turned by what it opens onto — the angle is what reports the state,
    /// and `ArgoDisclosure` is one symbol rotated so it can animate between the two.
    private var chevron: some View {
        ArgoDisclosure(isShowing ? .below : .beside)
            .frame(width: Self.gutter, alignment: .leading)
    }
}

#Preview("Archive foot — shut, open, and under the pointer") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        RosterArchiveFoot(
            label: "Archived (2)", announcement: "Archived, 2 Sessions",
            isShowing: false, toggle: {},
        )
        RosterArchiveFoot(
            label: "Archived (2)", announcement: "Archived, 2 Sessions",
            isShowing: true, toggle: {},
        )
        RosterArchiveFoot(
            label: "Archived (2)", announcement: "Archived, 2 Sessions",
            isShowing: false, toggle: {}, isPointedAtForRender: true,
        )
    }
    .padding(ArgoSpacing.loose)
    .frame(width: 280)
    .argoAppearance()
}
