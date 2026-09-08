import ArgoEngine
import Testing

@Suite("Live Plan", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LivePlanTests {
    @Test(.timeLimit(.minutes(5)))
    func `an Argo launched Claude Session creates and updates its three step Plan`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }

        try live.ask(
            "Use TaskCreate to create exactly three tasks with subjects Probe one, Probe two, "
                + "and Probe three, in that order. Use TaskUpdate to set Probe one in_progress. "
                + "Leave the other two pending. Do not use TodoWrite or modify any files. "
                + "If needed, load TaskCreate and TaskUpdate with ToolSearch first.",
        )
        let initial = [
            PlanEntry(text: "Probe one", status: .inProgress),
            PlanEntry(text: "Probe two", status: .pending),
            PlanEntry(text: "Probe three", status: .pending),
        ]
        await live.settle(seconds: 120) { Self.entries(in: live) == initial }
        try #require(Self.entries(in: live) == initial, "\(live.host.lastScreens)")

        await live.settle(seconds: 30) { live.session?.status == .idle }
        try #require(live.session?.status == .idle, "\(live.host.lastScreens)")
        try live.ask("Use TaskUpdate to mark Probe one completed and Probe two in_progress.")
        let updated = [
            PlanEntry(text: "Probe one", status: .completed),
            PlanEntry(text: "Probe two", status: .inProgress),
            PlanEntry(text: "Probe three", status: .pending),
        ]
        await live.settle(seconds: 120) { Self.entries(in: live) == updated }
        #expect(Self.entries(in: live) == updated, "\(live.host.lastScreens)")
    }

    private static func entries(in live: LiveClaudeFixture) -> [PlanEntry]? {
        live.session?.events.reversed().compactMap { event -> Plan? in
            guard case let .plan(plan) = event else { return nil }
            return plan
        }.first?.entries
    }
}
