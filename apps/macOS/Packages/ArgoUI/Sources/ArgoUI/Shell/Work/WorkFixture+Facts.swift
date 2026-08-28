import ArgoEngine
import Foundation

/// What the fixture's tickets carry beyond a listing's bare fields — the provider's own priority
/// and type words, the two bodies a render opens on, and the Deliveries in flight.
///
/// The first three land ON the items (`carrying`), because that is where the port now reads them
/// (#820). They are held as maps here only so the twelve-item list beside this one stays a list of
/// tickets rather than a wall of fields. The Deliveries stay beside the items for the reason they
/// always did: nothing reads a code host yet (#258).
extension WorkFixture {
    /// The provider's own priority word per ticket, verbatim and lowercase — which is how this
    /// tracker spells one. Argo neither ranks these nor recases them.
    static let priorities: [Int: String] = [
        607: "high", 609: "high", 388: "high", 272: "high",
        273: "medium", 334: "medium", 335: "medium", 763: "medium",
        336: "low", 275: "low", 160: "low", 185: "low",
    ]

    /// The provider's own type word, and note `PRD` keeps its capitals: a type is a property rather
    /// than a rung of a ladder (#160), so it is spelled the way the tracker spells it.
    static let types: [Int: String] = [
        607: "PRD", 334: "PRD",
        609: "design",
        388: "task", 272: "task", 273: "task", 335: "task", 336: "task", 763: "task", 275: "task",
        160: "decision", 185: "decision",
    ]

    /// The standard reading with the priority words edited. Priority lives ON a `Ticket` now
    /// (#820), so a case that wants a different word rebuilds the items rather than patching a
    /// dictionary beside them — which is also what stops one from drifting from the other.
    static func reading(priorities edit: (inout [Int: String]) -> Void) -> WorkReading {
        var words = priorities
        edit(&words)
        var reading = reading(showing: 272)
        reading.items = items.map { priced($0, words[$0.number]) }
        return reading
    }

    private static func priced(_ item: Ticket, _ word: String?) -> Ticket {
        Ticket(copying: item, priority: word)
    }

    /// The bodies, on the two tickets a render opens on. Every other ticket carries none, which is
    /// the ordinary case: a listing answers with what the provider filed, and most of it is empty.
    static let bodies: [Int: String] = [272: body, 607: parentBody]

    /// Two Deliveries on one ticket, and one on each of two others — the counts the chips have to
    /// survive, and the two check readings side by side.
    static let deliveryFacts: [Int: [DeliveryFacts]] = [
        607: [
            delivery(812, "argo/#607-work-room-rail", diff: (412, 96), checks: .passing),
            delivery(829, "argo/#607-ticket-detail", diff: (188, 12), checks: .failing),
        ],
        763: [delivery(791, "argo/#763-ticket-port", diff: (640, 210), checks: .passing)],
        609: [delivery(834, "worktree-prototype-609-work-room", diff: (1180, 0), checks: .passing)],
    ]

    /// The chip's own discrete union, told once, plus the one boolean that changes its layout: a
    /// Delivery with no page to open draws as a fact rather than as a control.
    static let everyChip: [DeliveryFacts] = ChecksReading.allCases.enumerated().map {
        delivery(812 + $0.offset, "argo/#607-work-room-rail", diff: (412, 96), checks: $0.element)
    } + [unlinked]

    private static let unlinked = DeliveryFacts(
        name: "argo#815", branch: "argo/#815-ticket-fact-strip", added: 640, removed: 71,
        checks: .passing, url: nil,
    )

    /// The name and the page are built from ONE number, so a chip and what it opens can never be
    /// two different Deliveries.
    private static func delivery(
        _ number: Int, _ branch: String, diff: (added: Int, removed: Int), checks: ChecksReading,
    )
        -> DeliveryFacts {
        DeliveryFacts(
            name: "argo#\(number)",
            branch: branch,
            added: diff.added,
            removed: diff.removed,
            checks: checks,
            url: URL(string: "https://github.com/milad-alizadeh/argo/pull/\(number)"),
        )
    }
}
