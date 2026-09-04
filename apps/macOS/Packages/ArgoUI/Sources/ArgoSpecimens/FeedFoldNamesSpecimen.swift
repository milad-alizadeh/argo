import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The list an open fold puts out, in the four states its shape has to be judged in (#1228): the
/// row at rest, its list out, the pointer on one name, and the panel open on one name.
///
/// One fold drawn four times rather than four rows of a reading. Three of the four are states a
/// pointer or a click produces and a screenshot cannot reach, and the question being settled — that
/// the header and every name under it are one size, one weight and one rhythm — is only answerable
/// with the four stacked at one measure.
///
/// The fold chosen is the one in the shipping fixture whose list holds a call the record answered
/// with NOTHING, so the inert name is in every one of these stills beside the names that work.
struct FeedFoldNamesSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            if let fold = Self.fold {
                drawn("At rest", of: fold, FeedFoldOpening(isExpanded: false, expand: {}))
                drawn("Open", of: fold, opened())
                drawn("Pointer on a name", of: fold, opened(pointingAt: Self.named?.id))
                drawn("Panel open on that name", of: fold, opened(showing: Self.named?.goesTo))
            }
        }
        .padding(ArgoSpacing.section)
        .frame(width: ArgoFeedRow.column, alignment: .leading)
        .argoDeckSurface()
    }

    private func drawn(
        _ state: String,
        of fold: any FeedFolded,
        _ opening: FeedFoldOpening,
    )
        -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            GroupLabel(state)
            FeedFoldLine(fold: fold, opening: opening)
        }
    }

    /// The row with its list out. Inert: nothing here has a panel to send a press to, and what is
    /// being looked at is the list rather than what a press does.
    private func opened(pointingAt name: Int? = nil, showing step: Int? = nil) -> FeedFoldOpening {
        var opening = FeedFoldOpening(isExpanded: true, expand: {}, current: step)
        opening.pointsAt = name
        return opening
    }

    /// The fold whose list holds a name that goes nowhere — the call the record answered with
    /// nothing, listed because it happened.
    ///
    /// `if case` twice rather than a `switch` with a `default:`: `FeedRow.Content` is this
    /// package's own enum, and a `default:` there would swallow a twelfth kind silently
    /// (`rules/swift.md`).
    private static let fold: (any FeedFolded)? = FeedProjection.previewCallRows
        .compactMap { row -> (any FeedFolded)? in
            if case let .survey(survey) = row.content {
                return survey
            }
            if case let .work(work) = row.content {
                return work
            }
            return nil
        }
        .first { $0.steps.contains { $0.goesTo == nil } }

    /// The name the pointer and the panel are both put on: the LAST one that goes somewhere, so it
    /// is never the inert name and never the first in the box. Walked once — the still needs the
    /// name's own id AND the panel step behind it, and two walks could answer about two names.
    private static let named = fold?.steps.last { $0.goesTo != nil }
}

#Preview("Fold names — the four states of the list an open fold puts out") {
    FeedFoldNamesSpecimen()
        .argoAppearance()
}
