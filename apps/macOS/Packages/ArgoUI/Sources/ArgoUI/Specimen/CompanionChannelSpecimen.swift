import ArgoEngine
import SwiftUI

/// The companion channel's four states in one render (#493) — the ⓘ panel over four Sessions that
/// differ in nothing else.
///
/// Side by side rather than one PNG each, because the state that matters most draws NOTHING: an
/// external Session's panel is only judgeable against the three that say something.
struct CompanionChannelSpecimen: View {
    @Environment(\.argo) private var argo

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(CompanionLiveness.allCases, id: \.self) { liveness in
                column(liveness)
            }
        }
    }

    /// The heading is specimen chrome: the panel never names a state it is not in.
    private func column(_ liveness: CompanionLiveness) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            Text(Self.word(for: liveness))
                .argoText(ArgoTypography.badge)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
                .padding(.leading, ArgoSpacing.region)
            ContextGuideSpecimen(header: Self.header(liveness))
        }
    }

    private static func word(for liveness: CompanionLiveness) -> String {
        switch liveness {
        case .live: "Live"
        case .neverDialled: "Never dialled"
        case .dropped: "Dropped"
        case .notApplicable: "Not applicable"
        }
    }

    /// One Session per state, projected as the shell projects one. `notApplicable` is the external
    /// posture, because that is what it means in practice.
    private static func header(_ liveness: CompanionLiveness) -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "companion-\(liveness)",
            title: "Say whether the companion channel is live",
            access: liveness == .notApplicable ? .external : .managed,
            status: .idle,
            chain: .init(
                cli: .claude,
                model: "claude-opus-5",
                startedAtMs: 0,
                lastSeenAtMs: 12 * 60000,
                companionChannel: liveness,
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .worktree, branch: "argo/#493-companion-liveness"),
                ticket: .linked(.init(
                    number: 493,
                    title: "Say whether the companion channel is live",
                )),
            ),
            spend: .init(contextTokens: 67175),
        ))
    }
}

#Preview("Companion channel — the four states of one Session's channel") {
    CompanionChannelSpecimen()
        .argoAppearance()
}
