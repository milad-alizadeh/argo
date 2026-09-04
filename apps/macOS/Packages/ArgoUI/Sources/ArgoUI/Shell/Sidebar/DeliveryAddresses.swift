import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The two addresses a Session's run answers to, at the trailing edge of line 3
/// (`cockpit-roster-row.md` — `DeliveryAddresses`). A Ticket is an address; a pull request is an
/// address WITH a state — which is why the two differ in SHAPE before their colours do, and why
/// only the pull request's mark ever changes ink.
///
/// Draws nothing at all where it is handed nothing: a Session on no Ticket, or a branch with no
/// pull request open, leaves its half of the pair blank rather than a placeholder.
struct DeliveryAddresses: View {
    @Environment(\.argo) private var argo

    let ticketNumber: Int?
    let pullRequest: DeliveryPullRequest?

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ticketAddress
            pullRequestAddress
        }
    }

    /// The Tickets room's own mark (`ArgoSymbol.ticketsRoom`) — the glyph the reader already
    /// clicks to go and read this Ticket, so a second one here would be a second vocabulary for
    /// the same thing. The quiet ink: an address alone carries no state of its own.
    @ViewBuilder private var ticketAddress: some View {
        if let ticketNumber {
            address(IssueReading.mark(ticketNumber)) {
                ArgoGlyph(ArgoSymbol.ticketsRoom, .inline)
            }
            .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// The code host's own fork, and its merge mark once it has landed — never the ticket's
    /// glyph, and never the same glyph for both of a pull request's two shapes.
    @ViewBuilder private var pullRequestAddress: some View {
        if let pullRequest {
            address(IssueReading.mark(pullRequest.number)) {
                pullRequestMark(for: pullRequest)
            }
            .foregroundStyle(pullRequest.ink(in: argo.color))
        }
    }

    private func address(_ text: String, @ViewBuilder mark: () -> some View) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            mark()
            Text(text)
        }
        .argoText(ArgoTypography.machineCaption)
    }

    private func pullRequestMark(for pullRequest: DeliveryPullRequest) -> some View {
        let shape: AnyShape = pullRequest.isMerged
            ? AnyShape(MergedPullRequestMark())
            : AnyShape(OpenPullRequestMark())
        return shape
            .stroke(style: StrokeStyle(
                lineWidth: ArgoStroke.border,
                lineCap: .round,
                lineJoin: .round,
            ))
            .frame(width: ArgoIconSize.inline.rawValue, height: ArgoIconSize.inline.rawValue)
    }
}

/// The engine's own pull request read against the contract — kept beside the view that is its
/// one caller rather than inside it, so the mark's shape and its ink are decided in one place
/// each (`ArgoOperationalState.tint(in:)` is the same split for a Session's own state).
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

#Preview("Delivery addresses — the shapes it comes in") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        DeliveryAddresses(ticketNumber: 1269, pullRequest: .fixture(state: "open"))
        DeliveryAddresses(ticketNumber: 1269, pullRequest: .fixture(state: "open", isDraft: true))
        DeliveryAddresses(ticketNumber: 1269, pullRequest: .fixture(state: "closed"))
        DeliveryAddresses(
            ticketNumber: 1269, pullRequest: .fixture(state: "closed", isMerged: true),
        )
        DeliveryAddresses(ticketNumber: 1269, pullRequest: nil)
        DeliveryAddresses(ticketNumber: nil, pullRequest: .fixture(state: "open"))
    }
    .padding(ArgoSpacing.loose)
    .argoAppearance()
}

/// `package`, not `internal`: the roster specimen (`ArgoSpecimens`) needs the same five states
/// this preview does, and a second builder there would be the fixture pasted twice.
package extension DeliveryPullRequest {
    static func fixture(
        number: Int = 1312, state: String, isDraft: Bool = false, isMerged: Bool = false,
    )
        -> DeliveryPullRequest {
        DeliveryPullRequest(
            number: number,
            title: "Fixture pull request",
            state: state,
            facts: Facts(
                isDraft: isDraft, isMerged: isMerged, baseBranch: "main", headSHA: "abc123",
            ),
            body: nil,
            url: nil,
        )
    }
}
