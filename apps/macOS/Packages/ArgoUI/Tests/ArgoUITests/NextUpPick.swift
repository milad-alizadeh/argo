@testable import ArgoUI
import Testing

/// The pick out of a reading, for the three suites that assert on one. Held once: each of them had
/// its own copy of this and its own error beside it, which is three ways for one unwrap to drift.
enum NextUpPick {
    static func of(_ reading: TicketsReading) throws -> NextUp.Pick {
        try of(TicketsRoomProjection.room(from: reading))
    }

    static func of(_ room: TicketsRoomProjection.Room) throws -> NextUp.Pick {
        guard case let .pick(pick) = try #require(room.nextUp) else { throw Absent.notAPick }
        return pick
    }

    /// A tier where a suite expected a ticket. Thrown rather than asserted, so the failure names
    /// which of the two the room actually was.
    enum Absent: Error {
        case notAPick
    }
}
