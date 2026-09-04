import ArgoDesign
import SwiftUI

/// What runs UNDER a Session, drawn under the Session's own state dot (#1344,
/// `cockpit-roster-row.md`). The leading column belongs to the machinery, and nothing else on the
/// row may claim it.
///
/// Four readings and four marks, because the four are four different facts — see
/// `SessionRosterProjection.Delegation`. Never-delegated draws nothing at all; delegated and all
/// home draws a dash, which is a different sentence.
struct SubagentDots: View {
    /// Where a stack stops being countable at a glance. Past it the column says the exact figure it
    /// is NOT drawing, because a longer stack is texture rather than a number.
    static let ceiling = 5

    /// The gap between the marks in the column, read by `SessionMarker` too: the stack has to read
    /// as one column rather than as a list, so its rhythm is stated once and is tighter than the
    /// row's own.
    static let stackGap: CGFloat = 3

    /// Half the state dot: what runs under a Session is drawn smaller than the Session's own state.
    private static let dot = ArgoIconSize.statusDot / 2

    /// Wide enough to read as a rule rather than as a dot that failed to fill.
    private static let dashWidth: CGFloat = 5

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
                .frame(width: Self.dot, height: Self.dot)
        }
    }

    @ViewBuilder private func running(_ count: Int) -> some View {
        ForEach(0 ..< min(count, Self.ceiling), id: \.self) { _ in
            Circle()
                .fill(ArgoOperationalState.running.tint(in: argo.color))
                .frame(width: Self.dot, height: Self.dot)
        }
        if count > Self.ceiling {
            // IN the column's flow at the column's OWN width, so it overflows evenly on both sides
            // and the column does not grow by a point. Every title on the roster stays on one x.
            Text("+\(count - Self.ceiling)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .fixedSize()
                .frame(width: SessionMarker.columnWidth)
        }
    }
}
