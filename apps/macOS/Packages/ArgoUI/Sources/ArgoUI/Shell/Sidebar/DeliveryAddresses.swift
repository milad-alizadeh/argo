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
                DeliveryPullRequestMark(pullRequest: pullRequest)
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
