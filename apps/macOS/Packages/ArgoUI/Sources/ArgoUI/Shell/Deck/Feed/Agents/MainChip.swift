import ArgoDesign
import SwiftUI

/// The Session's own reading, at the head of the rail.
///
/// A chip like the Agents under it — not a card and not a back button (D33, #1013). The rail is
/// then the list of readings this Session has with the root one first, and the way out of a
/// Subagent is the same gesture as the way in rather than a control a reader has to be told about.
package struct MainChip: View {
    @Environment(\.argo) private var argo

    let isSelected: Bool
    let select: () -> Void

    package var body: some View {
        Button(action: select) { line }
            .buttonStyle(FeedRowButtonStyle(isOpen: isSelected))
            .accessibilityLabel(AgentsRailCopy.main)
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    /// The leading slot is the Agents' state-dot slot kept EMPTY, so the names line up and this row
    /// still makes no claim: the root Agent's state is the Session's own, which this rail is not
    /// told. The collapsed strip draws a mark there instead, because that is the only form where
    /// the word `Main` is not on screen to say which row this is.
    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            Spacer()
                .frame(width: ArgoIconSize.statusDot)
            Text(AgentsRailCopy.main)
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, ArgoSpacing.tight)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(isSelected: Bool, select: @escaping () -> Void) {
        self.isSelected = isSelected
        self.select = select
    }
}
