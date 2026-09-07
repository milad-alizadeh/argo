import ArgoDesign
import ArgoEngine
import SwiftUI

/// What every surface that draws a pull request reads off it: the ink, and which of the two marks
/// it draws. Shared rather than pasted twice — the roster row (`DeliveryAddresses`) and the deck
/// header (`SessionPullRequestLink`) are the callers, and two copies of either decision is two
/// chances for them to disagree about the same fact (`cockpit-roster-row.md`,
/// `cockpit-session-header.md`).
extension DeliveryPullRequest {
    /// Merged first: it is the pull request's terminal state, and the same reading `Delivery.stage`
    /// takes it in. A closed pull request that never merged snaps to `state.failure` and a draft to
    /// `state.idle` — the contract's own two, rather than near-duplicate roles of their own
    /// (#1341). `delivery.open` covers every other host word this reads today.
    func ink(in palette: ArgoPalette) -> ArgoColor {
        if isMerged {
            return palette.delivery.merged
        }
        if isDraft {
            return palette.state.idle
        }
        if state == "closed" {
            return palette.state.failure
        }
        return palette.delivery.open
    }
}

/// The stroked mark for a pull request, sized to `ArgoIconSize.inline` — `MergedPullRequestMark`
/// once it has landed, `OpenPullRequestMark` otherwise. Never the ticket's own glyph, which the
/// link beside it already spends.
struct DeliveryPullRequestMark: View {
    let pullRequest: DeliveryPullRequest

    var body: some View {
        let shape: AnyShape = pullRequest.isMerged
            ? AnyShape(MergedPullRequestMark())
            : AnyShape(OpenPullRequestMark())
        shape
            .stroke(style: StrokeStyle(
                lineWidth: ArgoStroke.border,
                lineCap: .round,
                lineJoin: .round,
            ))
            .frame(width: ArgoIconSize.inline.rawValue, height: ArgoIconSize.inline.rawValue)
    }
}

/// The code host's own pull-request mark: two nodes on the branch, forking into the one the row's
/// Session opened. Drawn rather than an SF Symbol because no rung of `ArgoSymbol` names this
/// shape, and the ticket mark beside it already spends `checklist` — a second borrowed glyph would
/// be the second vocabulary the design rules against.
private struct OpenPullRequestMark: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = rect.width / 16
        let nodeRadius = 1.7 * scale
        var path = Path()
        path.addArc(
            center: CGPoint(x: 4.2 * scale, y: 4 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.move(to: CGPoint(x: 4.2 * scale, y: 5.7 * scale))
        path.addLine(to: CGPoint(x: 4.2 * scale, y: 10.5 * scale))
        path.addArc(
            center: CGPoint(x: 4.2 * scale, y: 12.2 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.addArc(
            center: CGPoint(x: 11.8 * scale, y: 12.2 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.move(to: CGPoint(x: 11.8 * scale, y: 10.5 * scale))
        path.addLine(to: CGPoint(x: 11.8 * scale, y: 6.6 * scale))
        path.addQuadCurve(
            to: CGPoint(x: 9.8 * scale, y: 4.6 * scale),
            control: CGPoint(x: 11.8 * scale, y: 4.6 * scale),
        )
        path.addLine(to: CGPoint(x: 7.2 * scale, y: 4.6 * scale))
        path.move(to: CGPoint(x: 8.8 * scale, y: 3 * scale))
        path.addLine(to: CGPoint(x: 7.2 * scale, y: 4.6 * scale))
        path.addLine(to: CGPoint(x: 8.8 * scale, y: 6.2 * scale))
        return path
    }
}

/// The same fork, landed: the branch that used to run to the open node above runs to one at the
/// SAME height as the first instead, which is what a merge draws.
private struct MergedPullRequestMark: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = rect.width / 16
        let nodeRadius = 1.7 * scale
        var path = Path()
        path.addArc(
            center: CGPoint(x: 4.2 * scale, y: 4 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.move(to: CGPoint(x: 4.2 * scale, y: 5.7 * scale))
        path.addLine(to: CGPoint(x: 4.2 * scale, y: 10.5 * scale))
        path.addArc(
            center: CGPoint(x: 4.2 * scale, y: 12.2 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.addArc(
            center: CGPoint(x: 11.8 * scale, y: 4 * scale), radius: nodeRadius,
            startAngle: .degrees(0), endAngle: .degrees(360), clockwise: true,
        )
        path.move(to: CGPoint(x: 11.8 * scale, y: 5.7 * scale))
        path.addLine(to: CGPoint(x: 11.8 * scale, y: 6.5 * scale))
        path.addQuadCurve(
            to: CGPoint(x: 7.8 * scale, y: 10.5 * scale),
            control: CGPoint(x: 11.8 * scale, y: 10.5 * scale),
        )
        path.addLine(to: CGPoint(x: 5.9 * scale, y: 10.5 * scale))
        return path
    }
}
