import ArgoDesign
import ArgoEngine
import SwiftUI

/// The tab line's reading of the branch's own pull request, beside the Ticket link it follows
/// (#1592; `cockpit-session-header.md`). Same shape as `SessionIssueLink`, a `GlyphMarkLine` in
/// the tab line's typography — but the ink and the mark are the roster row's own
/// (`DeliveryPullRequest.ink(in:)`, `DeliveryPullRequestMark`), never a second decision about
/// either fact, and never the Ticket's glyph, which the link beside it already spends.
///
/// `nil` draws nothing at all: a branch with no pull request open leaves this half of the tab
/// line blank, the same rule `DeliveryAddresses` follows for the roster row.
struct SessionPullRequestLink: View {
    @Environment(\.argo) private var argo
    @Environment(\.openURL) private var openURL

    let pullRequest: DeliveryPullRequest?

    var body: some View {
        if let pullRequest {
            if let url = pullRequest.url {
                Button { openURL(url) } label: { line(for: pullRequest) }
                    .buttonStyle(.plain)
                    .help("Open PR #\(pullRequest.number) on the code host")
            } else {
                // A host that gave no page is not a dead button (#1592, acceptance 7).
                line(for: pullRequest)
            }
        }
    }

    private func line(for pullRequest: DeliveryPullRequest) -> some View {
        GlyphMarkLine(text: "PR #\(pullRequest.number)", ink: pullRequest.ink(in: argo.color)) {
            DeliveryPullRequestMark(pullRequest: pullRequest)
        }
    }
}

#Preview("Session pull request link — the four inks, and none") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        SessionPullRequestLink(pullRequest: .fixture(number: 1589, state: "open"))
        SessionPullRequestLink(pullRequest: .fixture(number: 1589, state: "open", isDraft: true))
        SessionPullRequestLink(pullRequest: .fixture(number: 1589, state: "closed"))
        SessionPullRequestLink(
            pullRequest: .fixture(number: 1589, state: "closed", isMerged: true),
        )
        SessionPullRequestLink(pullRequest: nil)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
