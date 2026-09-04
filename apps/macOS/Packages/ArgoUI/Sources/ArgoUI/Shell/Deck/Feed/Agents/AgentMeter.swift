import ArgoDesign
import ArgoEngine
import SwiftUI

/// What one Subagent cost, on every chip: how long it ran, and what it spent.
///
/// Both figures are LABELLED. A bare `143.6K` beside a name is a number nobody can name — tokens,
/// dollars, lines — and a chip is exactly where a reader has least context to guess from.
///
/// A running Agent has neither total yet: the host measures the whole run and reports it with the
/// delegating call's result. So the duration counts UP from the handover instead, and the spend
/// slot stays empty rather than drawing a `0` that would claim a busy agent had spent nothing.
///
/// A backgrounded Agent is never reported either figure, at either end (#908) — so a finished one
/// draws NOTHING here. The count-up is gated on `isRunning` for exactly that: a clock still growing
/// beside an idle dot would say the work goes on, which is the untruth the rail was fixed to stop.
/// That gate carries the delegating Session's own status too (`DelegatingSession`), so a stale
/// delegation draws no duration rather than a frozen one.
struct AgentMeter: View {
    @Environment(\.argo) private var argo

    let agent: FeedAgent

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            duration
            // Between the two figures and only when both are there: `3m 43s 143.6K tokens` reads as
            // one number with a unit in the middle of it, which is the mistake the labels prevent.
            if agent.durationMs != nil, agent.spend != nil {
                Text(verbatim: "·")
            }
            spend
        }
        .argoText(ArgoTypography.machineCaption)
        .monospacedDigit()
        .foregroundStyle(argo.color.text.tertiary)
        .lineLimit(1)
    }

    /// The reported total once it lands, and a live count until then. Ticking wraps only this text:
    /// a timeline any wider re-renders the whole chip, which restarts its siblings' animation
    /// mid-pass — the trap `RosterTurnClock` names.
    @ViewBuilder private var duration: some View {
        if let durationMs = agent.durationMs {
            Text(TurnClockPhrase.figure(seconds: durationMs / 1000))
        } else if agent.isRunning, let startedAtMs = agent.startedAtMs {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                Text(counted(from: startedAtMs, at: context.date))
            }
            // The dot's own ink as a figure, exactly as `RosterTurnClock` spends it: a duration
            // still growing is the one thing in this rail drawn in the running colour.
            .foregroundStyle(ArgoOperationalState.running.tint(in: argo.color))
        }
    }

    private func counted(from startedAtMs: Int, at now: Date) -> String {
        TurnClockPhrase.figure(
            seconds: TurnClockPhrase.seconds(sinceMs: startedAtMs, nowMs: now.epochMs),
        )
    }

    /// Absent for an Agent still out, and absent for a record that priced nothing — the two read
    /// alike here, because neither is a claim that the work was free. The fresh half only, and
    /// `FeedSpend.agent` carries why.
    @ViewBuilder private var spend: some View {
        if let spend = agent.spend {
            Text(FeedSpend.agent(spend))
        }
    }
}

#Preview("Agent meter — landed, and one still counting up") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        AgentMeter(agent: FeedAgent(
            id: 0,
            label: "Verify the fold",
            isRunning: false,
            spend: Usage(
                inputTokens: 3600,
                outputTokens: 40000,
                cacheReadTokens: 100_000,
                cacheCreationTokens: 0,
            ),
            durationMs: 223_591,
        ))
        AgentMeter(agent: FeedAgent(
            id: 1,
            label: "Sweep the stop reasons",
            isRunning: true,
            spend: nil,
            startedAtMs: Date().epochMs - 42000,
        ))
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
