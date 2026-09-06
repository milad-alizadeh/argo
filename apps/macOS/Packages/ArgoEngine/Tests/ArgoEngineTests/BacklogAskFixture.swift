@testable import ArgoEngine
import Foundation

/// The backlog the ask suites read: nine tickets whose titles, labels and edges carry the whole of
/// what each one is about.
///
/// **Every ticket here also has a body, and no answer may use one.** The bodies contradict the
/// titles on purpose — a suite that only shipped titles could not tell a prompt built from the
/// listing from one built off whatever the room had cached.
enum BacklogAskFixture {
    static let tickets: [Ticket] = [
        ticket(
            1, "The roster row shows the wrong Session title after a spawn",
            labels: ["bug"], type: "bug", priority: "P1",
        ),
        ticket(
            2, "Warm the Swift build so a fresh worktree does not pay for it twice",
            labels: ["enhancement"], type: "task", priority: "P2",
        ),
        ticket(
            3, "The screenshot comes out blank without Screen Recording permission",
            labels: ["bug", "needs-triage"], type: "bug",
        ),
        ticket(
            4, "Atlas: the boxes travel when the map is re-tiled",
            labels: ["enhancement"], type: "task", blockedBy: [6],
        ),
        ticket(
            5, "Atlas: the camera flies to the plate it descends into",
            labels: ["enhancement"], type: "task", blockedBy: [6],
        ),
        ticket(
            6,
            "Atlas: one tiling pass produces the plates",
            labels: ["enhancement"],
            type: "task",
            blockedBy: [],
        ),
        ticket(
            7,
            "Retire the macOS CI runner and gate Swift at push time",
            labels: ["chore"],
            type: "task",
            priority: "P1",
            blockedBy: [],
        ),
        ticket(8, "A question asked of the backlog", type: "PRD", blockedBy: []),
        ticket(
            9,
            "The feed opens at its tail",
            labels: ["enhancement"],
            type: "task",
            status: "closed",
        ),
    ]

    /// The body every fixture ticket carries. One string, and a false one, so a prompt that leaked
    /// any body at all is caught by a single search rather than nine.
    static let body = "SECRET BODY: this ticket is really about the espresso machine."

    private static func ticket(
        _ number: Int,
        _ title: String,
        labels: [String] = [],
        type: String? = nil,
        priority: String? = nil,
        blockedBy: [Int]? = nil,
        status: String = "open",
    )
        -> Ticket {
        Ticket(
            number: number, title: title, status: status,
            closure: status == "open" ? .open : .resolved,
            labels: labels.map { TicketLabel(name: $0) },
            priority: priority, type: type,
            blockedBy: blockedBy?.map { TicketBlocker(number: $0, closure: .open) },
            body: body,
        )
    }
}
