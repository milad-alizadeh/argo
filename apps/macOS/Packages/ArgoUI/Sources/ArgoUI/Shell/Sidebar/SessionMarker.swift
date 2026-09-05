import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The roster row's leading column (`cockpit-roster-row.md`): what the Session is DOING, or — on a
/// fold — whether it is open.
///
/// It takes the whole row rather than a state and a fold, so no caller can hand it both.
struct SessionMarker: View {
    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row

    var body: some View {
        VStack(spacing: ArgoSpacing.subagentGap) {
            Group {
                if let fold = row.fold {
                    ArgoDisclosure(fold.isOpen ? .below : .beside)
                        .foregroundStyle(argo.color.text.tertiary)
                        .accessibilityHidden(true)
                } else {
                    SessionStateIndicator(state: row.state)
                }
            }
            .padding(.top, Self.inset(for: markSize))
            // What runs under this Session, drawn smaller than the state above it — never
            // claimed for a Session Argo cannot place (rule 5, `SessionRosterProjection`).
            if let subagents = row.subagents, subagents != .none {
                SubagentDots(reading: subagents)
            }
        }
        .frame(width: Self.columnWidth)
    }

    private var markSize: CGFloat {
        row.fold != nil ? ArgoIconSize.chevron.rawValue : ArgoIconSize.statusDot
    }
}

extension SessionMarker {
    /// The column's width. A wider mark overflows it evenly on both sides rather than growing it,
    /// so every title on the roster starts at one x.
    static let columnWidth = ArgoIconSize.statusDot

    /// What one line of the title occupies as drawn. The face the platform resolves, not the
    /// rung's documented size at the ladder's ratio: the two differ by an amount with no fixed
    /// sign (`ArgoTypeScale.drawnLineBox`), and the mark is centred against what is on the screen.
    static var titleLineBox: CGFloat {
        ArgoTypography.rowTitle.rung.drawnLineBox
    }

    /// Where a mark of this size starts, so its centre is the title line's centre. Derived off the
    /// role, so the mark cannot drift when the type scale moves (#1343).
    static func inset(for mark: CGFloat) -> CGFloat {
        (titleLineBox - mark) / 2
    }
}
