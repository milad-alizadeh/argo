import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The roster row's leading column (`cockpit-roster-row.md`): what the Session is DOING, or — on a
/// fold — whether it is open. One of the two is a state and the other is a control, and no row is
/// both.
///
/// A column and not a slot on the first line, because the row is three lines now and the mark
/// belongs to the title alone. It is framed to the state dot's own width either way, so every
/// title on the roster — folds included — starts at one x whatever the mark inside it is.
struct SessionMarker: View {
    @Environment(\.argo) private var argo

    /// The fold this row stands for, and `nil` on an ordinary Session row.
    let fold: SessionRosterProjection.Fold?
    let state: ArgoOperationalState?
    /// When the Turn the dot reports began — what its sweep ages off (#1291). Passed straight
    /// through: the column decides where the mark sits, never what it says.
    var turnStartedAt: Date?

    var body: some View {
        Group {
            if let fold {
                ArgoDisclosure(fold.isOpen ? .below : .beside)
                    .foregroundStyle(argo.color.text.tertiary)
                    .padding(.top, Self.inset(for: ArgoIconSize.chevron.rawValue))
            } else {
                SessionStateIndicator(state: state, turnStartedAt: turnStartedAt)
                    .padding(.top, Self.inset(for: ArgoIconSize.statusDot))
            }
        }
        .frame(width: Self.columnWidth)
        .accessibilityHidden(true)
    }
}

/// The column's one measurement, beside the view rather than in it: where a mark starts so that it
/// lands on the title's optical centre.
extension SessionMarker {
    /// The column's width, which is the state dot's own — a mark inside it may be wider and
    /// overflows evenly on both sides rather than growing the column by a point. Every title on
    /// the roster, folds included, therefore starts at one x.
    static let columnWidth = ArgoIconSize.statusDot

    /// What one line of the title occupies as drawn — the box the mark is centred against.
    static var titleLineBox: CGFloat {
        ArgoTypography.rowTitle.rung.drawnLineBox
    }

    /// Where a mark of this size starts, so its centre is the title line's centre.
    ///
    /// DERIVED, never nudged: a marker aligned by a magic number drifts the moment the type scale
    /// moves, and the mark and the line it answers to are then saying different things about the
    /// same row. It reads off the role rather than off a rung's documented size, because the title
    /// is drawn at the face the platform resolves and not at the number the HIG prints
    /// (`ArgoTypeScale.drawnLineBox`).
    static func inset(for mark: CGFloat) -> CGFloat {
        (titleLineBox - mark) / 2
    }
}

#Preview("Session marker — a state and a fold, against the title they centre on") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        HStack(alignment: .top, spacing: ArgoSpacing.base) {
            SessionMarker(fold: nil, state: .running)
            Text("A Session, and its state").argoText(ArgoTypography.rowTitle)
        }
        HStack(alignment: .top, spacing: ArgoSpacing.base) {
            SessionMarker(
                fold: SessionRosterProjection.Fold(
                    id: "fold:roster:preview", count: 4, label: "ticket-1343", isOpen: false,
                ),
                state: nil,
            )
            Text("4 runs").argoText(ArgoTypography.rowTitle)
        }
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
