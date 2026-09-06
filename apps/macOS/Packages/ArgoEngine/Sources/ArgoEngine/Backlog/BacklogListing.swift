import Foundation

/// The backlog as a model reads it: one line per Ticket, from the listing the room already holds.
///
/// **The body is not here, and that is the point.** A Ticket carries `body`, filled for whichever
/// tickets a reader happened to open, so an answer written from bodies changes between two readers
/// of the same view. Everything below is served by the listing poll for every ticket at once, which
/// is what makes the same question over the same backlog give the same answer twice (#1315).
enum BacklogListing {
    /// The listing rendered for a prompt, newest-first in the order the room gives it.
    static func lines(_ tickets: [Ticket]) -> String {
        tickets.map(line).joined(separator: "\n")
    }

    /// One ticket. Absent facts are omitted rather than spelled as a default, so the model is never
    /// told a priority nothing set (`CONTEXT.md` L2 · degrade-down).
    static func line(_ ticket: Ticket) -> String {
        (["#\(ticket.number)", "[\(ticket.status)]"] + facts(ticket) + [ticket.title])
            .joined(separator: " ")
    }

    private static func facts(_ ticket: Ticket) -> [String] {
        [
            ticket.type.map { "type=\($0)" },
            ticket.priority.map { "priority=\($0)" },
            labels(ticket),
            blockedBy(ticket),
        ].compactMap(\.self)
    }

    private static func labels(_ ticket: Ticket) -> String? {
        guard !ticket.labels.isEmpty else { return nil }
        return "labels=" + ticket.labels.map(\.name).joined(separator: ",")
    }

    /// The edges, and nothing at all where the provider served none — which is UNKNOWN and not "no
    /// blockers", so a line that omitted the difference would invite an answer asserting one.
    private static func blockedBy(_ ticket: Ticket) -> String? {
        guard let blockers = ticket.blockedBy else { return nil }
        guard !blockers.isEmpty else { return "blockedBy=none" }
        return "blockedBy=" + blockers.map { "#\($0.number)" }.joined(separator: ",")
    }
}
