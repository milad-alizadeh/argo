import SwiftUI

/// The rail, re-dated on a beat of its own (#1392).
///
/// The rail's dots are read from evidence that EXPIRES — a child's file last seen growing, an age
/// past the ceiling — and the reading that expires them is taken on a pass
/// (`FeedAgents.told(_:writing:ending:at:)`). Nothing in the deck takes a pass on a timer, so where
/// every child had fallen silent AND the parent never wrote again, nothing invalidated the column
/// and the last dot stood past its own window: four chips green at 2h29m over Subagents that had
/// filed their reports and stopped. This is the pass.
///
/// It wraps the RAIL and nothing else, which is the whole reason it is a view rather than a clock
/// in the room's stamp: a clock there would expire every memo in the room on a timer, and that cost
/// is what #858 and #875 exist to have removed. The reading it re-takes is a memo lookup and a
/// dictionary lookup per chip — the walk behind it stays memoised, because nothing that walk
/// answers has a clock in it.
struct AgentsRailZone: View {
    /// The dated reading, asked again on every beat. A closure and not a list: a list handed in
    /// was dated when the deck last laid out, which is the staleness this exists to end.
    let dating: () -> [FeedAgent]
    var control = AgentsRailControl.inert

    var body: some View {
        TimelineView(.periodic(from: Self.origin, by: Self.beatSeconds)) { _ in
            AgentsRail(agents: dating(), control: control)
        }
    }

    /// Half a minute. It bounds how long a dot may outlive its own evidence, and the evidence it
    /// bounds is measured in ten minutes (`SubagentWriting.growthWindowMs`) and four hours
    /// (`DelegationCeiling.reportWindowMs`) — so a beat this size is finer than the shorter of them
    /// by more than an order, and a reader cannot see a chip go stale between two of them.
    ///
    /// Not a second, which is what the chip's own clock ticks at (`AgentMeter`). That clock
    /// re-reads
    /// one number in one text; this rebuilds the column, and a rebuild a second is the per-pass
    /// cost
    /// the deck spent three tickets getting rid of.
    private static let beatSeconds: TimeInterval = 30

    /// A FIXED origin, not `.now`. The beat has to survive this view being rebuilt — a seam drag, a
    /// scope change, the deck re-laying out — or every rebuild would restart the schedule and the
    /// column would tick at whatever rate the reader happened to be causing.
    private static let origin = Date(timeIntervalSinceReferenceDate: 0)
}
