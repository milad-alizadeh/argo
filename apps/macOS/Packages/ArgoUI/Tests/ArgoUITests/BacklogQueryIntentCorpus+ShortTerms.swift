@testable import ArgoUI

extension BacklogQueryIntentCorpus {
    /// The plain field's bread and butter — short terms, and ticket numbers, `docs/agents/
    /// domain.md`'s other named case for the same field.
    static let shortTerms: [Entry] = [
        "auth", "search", "backlog", "sidebar", "fold state", "compaction", "the deck",
        "ticket pane", "start control", "session roster", "feed row", "atlas", "worktree",
        "quality gates", "swift gate", "honesty tier", "domain model", "next up",
        "empty state", "answer sheet", "citation", "vacancy", "narrowing", "TicketsRoomProjection",
        "ArgoControlBox", "biome.jsonc", "swiftlint", "rtk filters", "hooks.json",
        "code review", "pixel review", "prototype", "delivery", "cockpit", "roster",
        "specimen", "atlas layout", "chart places", "claim",
    ].map { Entry(query: $0, expected: .term, group: "short term") }

    static let ticketNumbers: [Entry] = [
        "1316", "#1316", "1293", "ticket 1316", "1242", "836", "873", "818", "820", "1075",
    ].map { Entry(query: $0, expected: .term, group: "ticket number") }
}
