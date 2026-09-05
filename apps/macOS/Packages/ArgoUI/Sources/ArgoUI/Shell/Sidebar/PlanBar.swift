import ArgoDesign
import ArgoEngine
import SwiftUI

/// How one Plan step reads in `PlanBar`, folding a step's own status in with whether the whole
/// bar has stopped moving (`cockpit-roster-row.md`). Its own type, and pure, so the rule that a
/// step caught mid-flight is not "got" once the Session stops is asserted without a view.
enum PlanBarFill: Equatable {
    case done
    case doing
    case pending

    /// A Session that is not running is not progressing: the step it was on when it stopped is
    /// not one the reader can act on any more, and reads exactly as pending rather than banking
    /// the fraction it never finished.
    static func reading(status: PlanEntryStatus, isStill: Bool) -> PlanBarFill {
        switch (status, isStill) {
        case (.completed, _): .done
        case (.inProgress, false): .doing
        case (.inProgress, true), (.pending, _): .pending
        }
    }
}

/// One segment per to-do item on the agent's Plan (`cockpit-roster-row.md`), filled to what is
/// done. A fixed width whatever the item count, so a reader compares two rows by how far the
/// fill got and never by how long the bar is.
package struct PlanBar: View {
    @Environment(\.argo) private var argo

    let plan: PlanReading
    /// A Session that is not running is not progressing (rule 3): every filled segment answers
    /// to `progress.still` rather than to the accent, and the step in progress when it stopped
    /// reads as pending — see `PlanBarFill`.
    let isStill: Bool

    private static let totalWidth: CGFloat = 64
    private static let height: CGFloat = 3

    package var body: some View {
        HStack(spacing: ArgoSpacing.hair) {
            ForEach(plan.steps) { step in
                segment(reading: PlanBarFill.reading(status: step.status, isStill: isStill))
            }
        }
        // The counter beside the pill already says this in words; a second reading here would
        // be the same fact twice.
        .accessibilityHidden(true)
    }

    /// One step. The step in progress BREATHES, on the row's own pass and the state dot's own
    /// curve, so the two live marks on a running row rise and fall together (#1403 — the second
    /// exception to `cockpit-roster-row.md` rule 8). Every other step is still: a bar where more
    /// than the live step moved would be the pulsing list rule 8 forbids.
    ///
    /// Only `.doing` is ever handed the breath, and a Session that is not running has no `.doing`
    /// step (`PlanBarFill`) — so "is this bar moving" and "is this Session live" are one answer and
    /// cannot come apart.
    ///
    /// It peaks at full and parks at full, where the dot's halo peaks at the rung's own glow and
    /// parks at the breath's floor: the halo is LIGHT around a mark that keeps its ink, while a
    /// segment IS the mark. The age still reaches the breath through the pass's PERIOD, so an old
    /// Turn breathes slower here exactly as it does on the dot.
    @ViewBuilder private func segment(reading: PlanBarFill) -> some View {
        let capsule = Capsule()
            .fill(ink(for: reading))
            .frame(width: segmentWidth, height: Self.height)
        if reading == .doing {
            BreathingMark(parkedAt: 1) { capsule }
        } else {
            capsule
        }
    }

    /// Derived from the count, floored so a long plan never draws a hairline: `(64 − hair ×
    /// (n−1)) / n`.
    private var segmentWidth: CGFloat {
        let count = plan.steps.count
        let gaps = CGFloat(count - 1) * ArgoSpacing.hair
        return max(2, (Self.totalWidth - gaps) / CGFloat(count))
    }

    private func ink(for reading: PlanBarFill) -> ArgoColor {
        switch reading {
        case .done: isStill ? argo.color.progress.still : argo.color.interaction.accent
        case .doing: argo.color.interaction.accentBright
        case .pending: argo.color.edge.subtle
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(plan: PlanReading, isStill: Bool) {
        self.plan = plan
        self.isStill = isStill
    }
}
