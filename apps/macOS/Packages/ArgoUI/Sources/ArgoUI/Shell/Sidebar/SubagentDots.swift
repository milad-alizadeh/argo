import ArgoDesign
import SwiftUI

/// What runs UNDER a Session, drawn under the Session's own state dot (#1344,
/// `cockpit-roster-row.md`). The leading column belongs to the machinery, and nothing else on the
/// row may claim it.
///
/// Four readings and four marks, because the four are four different facts
/// (`SessionRosterProjection.Delegation`). Never-delegated draws nothing at all; delegated and all
/// home draws a dash, because a column that answered both with a blank would say a Session that
/// fanned out and gathered everyone back never fanned out.
struct SubagentDots: View {
    /// Where a stack stops being countable at a glance. Past it the column says the exact figure it
    /// is NOT drawing, because a longer stack is texture rather than a number.
    static let ceiling = 5

    /// The gap between the marks, read by `SessionMarker` too so the column has one rhythm. Half
    /// the state dot, which is tighter than any rung of `ArgoSpacing` would place them: the stack
    /// has to read as one column rather than as a list of marks.
    static let stackGap = ArgoIconSize.statusDot / 2

    /// The width the dash spans, which is the state dot's own: the mark says the whole column came
    /// home, so it is drawn at the width of the thing the column hangs off.
    private static let dashWidth = ArgoIconSize.statusDot

    @Environment(\.argo) private var argo

    let delegation: SessionRosterProjection.Delegation

    var body: some View {
        switch delegation {
        case .none:
            EmptyView()
        case let .running(count):
            running(count)
        case .spent:
            // A DASH and not an outline: the outline is already spoken for by the reading below,
            // and two outlines under one dot read as two dots.
            Rectangle()
                .fill(argo.color.text.disabled)
                .frame(width: Self.dashWidth, height: ArgoStroke.hairline)
        case .unresolved:
            Circle()
                .strokeBorder(argo.color.text.disabled, lineWidth: ArgoStroke.hairline)
                .frame(width: ArgoIconSize.subagentDot, height: ArgoIconSize.subagentDot)
        }
    }

    @ViewBuilder private func running(_ count: Int) -> some View {
        ForEach(0 ..< min(count, Self.ceiling), id: \.self) { _ in
            Circle()
                .fill(ArgoOperationalState.running.tint(in: argo.color))
                .frame(width: ArgoIconSize.subagentDot, height: ArgoIconSize.subagentDot)
        }
        if count > Self.ceiling {
            // IN the column's flow at the column's OWN width, so it overflows evenly on both sides
            // and the column does not grow by a point. Every title on the roster stays on one x.
            Text("+\(count - Self.ceiling)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                // Sized to its own text and then held to the COLUMN's width, which the marker
                // fixes: it overflows evenly on both sides and the column does not grow by a
                // point. Every title on the roster stays on one x.
                .fixedSize()
                .frame(maxWidth: .infinity)
        }
    }
}
