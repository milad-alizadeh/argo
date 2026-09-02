import ArgoEngine
import SwiftUI

/// The companion channel's four states in one render (#493) — the ⓘ panel over four Sessions that
/// differ in nothing else.
///
/// Side by side rather than one PNG each, because the state that matters most here is the one that
/// draws NOTHING: an external Session's panel is only judgeable against the three that do say
/// something. Each column is headed by the state it stands for, which is specimen chrome — the
/// panel itself never names a state it is not in.
struct CompanionChannelSpecimen: View {
    @Environment(\.argo) private var argo

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.region) {
            ForEach(CompanionLiveness.allCases, id: \.self) { liveness in
                column(liveness)
            }
        }
        .padding(ArgoSpacing.region)
    }

    private func column(_ liveness: CompanionLiveness) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            Text(Self.word(for: liveness))
                .argoText(ArgoTypography.badge)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
            SessionContextGuide(facts: Self.facts(liveness))
                .glassEffect(in: .rect(cornerRadius: ArgoRadius.popover))
        }
    }

    /// The column heading — the state's own name in words, so a PNG says which panel is which
    /// without the reader counting columns.
    private static func word(for liveness: CompanionLiveness) -> String {
        switch liveness {
        case .live: "Live"
        case .neverDialled: "Never dialled"
        case .dropped: "Dropped"
        case .notApplicable: "Not applicable"
        }
    }

    /// One Session per state, projected exactly as the shell projects one. `notApplicable` is the
    /// external posture, because that is what it means in practice: a Session Argo never spawned
    /// was never going to have a channel.
    private static func facts(_ liveness: CompanionLiveness) -> [SessionHeaderProjection.Fact] {
        SessionHeaderProjection.facts(from: CockpitPresentation.Session(
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
