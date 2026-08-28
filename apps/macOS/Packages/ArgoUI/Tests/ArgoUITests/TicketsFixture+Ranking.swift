import ArgoEngine
@testable import ArgoUI
import Foundation

/// The pool a ranking case is built from (#273). Deliberately spare: `priority desc → PRD sequence
/// → age` reads three facts, so a candidate states those three and nothing that could explain a
/// pick some other way.
///
/// Beside the suites rather than in `Sources/` with the rest of `TicketsFixture`: no preview draws
/// a
/// ranking, so these two have no caller the app ships.
extension TicketsFixture {
    /// One takeable leaf. `blockedBy: []` throughout — a blocked leaf never reaches the pool, so a
    /// ranking case naming an edge would be testing the filter above the ranking instead.
    static func candidate(_ number: Int, priority: String? = nil, day: Int? = nil) -> Ticket {
        Ticket(
            number: number,
            title: "Candidate #\(number)",
            status: "Todo",
            closure: .open,
            priority: priority,
            blockedBy: [],
            updatedAt: day.map(touched),
        )
    }

    /// A chart over the candidates it sequences, in the order given: `children` is the provider's
    /// own author order, and that order IS the PRD sequence the ranking reads.
    static func chart(_ number: Int, sequencing children: [Int]) -> Ticket {
        Ticket(
            number: number, title: "A PRD", status: "Todo", closure: .open, type: "PRD",
            children: children, blockedBy: [],
        )
    }

    /// A day counted off one fixed instant, so `day:` reads as an offset a case can order in its
    /// head and no ranking depends on when the suite ran.
    private static func touched(_ day: Int) -> Date {
        Date(timeIntervalSince1970: 1_700_000_000).addingTimeInterval(TimeInterval(day) * 86400)
    }
}
