@testable import ArgoEngine
import Testing

@Suite("First Send")
@MainActor
struct PreparedSessionTests {
    @Test func `preparing Claude Code starts no process and first Send carries every choice`(
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        var preparation = try await fixture.hub.prepareSession(harness: .claude)
        #expect(fixture.host.launches.isEmpty)
        preparation.run = SessionRun(model: "sonnet", effort: .high)
        preparation.permission.select("manual")
        _ = try await fixture.hub.startPreparedSession(
            preparation,
            text: "Do the work",
            attachments: [],
        )
        let launch = try #require(fixture.host.launches.last)
        #expect(launch.arguments.contains("sonnet"))
        #expect(launch.arguments.contains("high"))
        #expect(launch.arguments.contains("manual"))
        #expect(launch.arguments.last == "Do the work")
    }

    @Test func `a Codex starts and changes its next Turn with its own Model and Effort`(
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let catalog = SessionRunCatalog(models: [
            .init(
                id: "codex-first",
                name: "First",
                efforts: [.medium, .high],
                defaultEffort: .medium,
            ),
            .init(id: "codex-second", name: "Second", efforts: [.low, .ultra], defaultEffort: .low),
        ])
        let preparation = SessionPreparation(
            harness: .codex,
            catalog: catalog,
            run: SessionRun(model: "codex-first", effort: .high),
            permission: codexPermissions(),
        )
        let id = try await fixture.hub.startPreparedSession(
            preparation,
            text: "First prompt",
            attachments: [],
        )
        let process = try #require(fixture.host.started.last)
        let server = CodexConversation(written: { process.written }, deliver: { process.emit($0) })
        server.open()
        #expect(server.request("turn/start")?.params.stringField("model") == "codex-first")
        #expect(server.request("turn/start")?.params.stringField("effort") == "high")
        server.started(turn: "first")
        _ = try await fixture.hub.driver.setPermission("fullAccess", for: id)
        try await fixture.hub.driver.setModel("codex-second", for: id)
        try await fixture.hub.driver.setEffort(.ultra, for: id)
        #expect(server.request("turn/start")?.params.stringField("model") == "codex-first")
        server.completedTurn()
        try fixture.hub.driver.send("Next prompt", to: id)
        #expect(server.request("turn/start")?.params.stringField("model") == "codex-second")
        #expect(server.request("turn/start")?.params.stringField("effort") == "ultra")
        #expect(server.request("turn/start")?.params.stringField("approvalPolicy") == "never")
        #expect(fixture.host.launches.count == 1)
        #expect(SessionRunStore(fileURL: fixture.runFileURL).lastPicked(
            for: .codex,
            fallback: preparation.run,
        )
            == SessionRun(model: "codex-second", effort: .ultra))
    }

    @Test func `a Ticket Session inherits remembered Codex settings and keeps them editable`(
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let remembered = SessionPreparation(
            harness: .codex, catalog: SpawnFixture.codexCatalog,
            run: SessionRun(model: "codex-default", effort: .high),
            permission: codexPermissions(),
        )
        fixture.hub.rememberPreparation(remembered)
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(
            opening: "Ticket work",
            ticket: 1692,
        ))
        let process = try #require(fixture.host.started.last)
        let server = CodexConversation(written: { process.written }, deliver: { process.emit($0) })
        server.open()
        #expect(server.request("turn/start")?.params.stringField("model") == "codex-default")
        #expect(server.request("turn/start")?.params.stringField("effort") == "high")
        #expect(fixture.hub.driver.surface(of: claim.value).chooses == .both)
        try await fixture.hub.driver.setEffort(.medium, for: claim.value)
        server.started(turn: "ticket-first")
        server.completedTurn()
        try fixture.hub.driver.send("Continue", to: claim.value)
        #expect(server.request("turn/start")?.params.stringField("effort") == "medium")
    }

    @Test func `each adapter authors its own permission choices`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claude = try await fixture.hub.prepareSession(harness: .claude)
        let codex = try await fixture.hub.prepareSession(harness: .codex)

        #expect(claude.permission.choices.map(\.name) == ["Allow", "Ask", "Deny", "Automode"])
        #expect(codex.permission.choices.map(\.name) == [
            "Ask for Approval", "Approve for Me", "Full Access",
        ])
        #expect(claude.permission.choices.allSatisfy { !$0.detail.isEmpty })
        #expect(codex.permission.choices.allSatisfy { !$0.detail.isEmpty })
    }

    @Test func `a live permission choice becomes that harness next prepared choice`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        _ = try await fixture.hub.driver.setPermission("manual", for: claim.value)
        let next = try await fixture.hub.prepareSession(harness: .claude)

        #expect(next.permission.selectedID == "manual")
    }
}

private func codexPermissions() -> SessionPermissionProfile {
    SessionPermissionProfile(
        choices: [
            .init(id: "ask", name: "Ask for Approval", detail: "Ask first", mode: .readOnly),
            .init(id: "approve", name: "Approve for Me", detail: "Approve safe work", mode: .code),
            .init(id: "fullAccess", name: "Full Access", detail: "Ask nothing", mode: .auto),
        ],
        selectedID: "approve",
        defaultID: "approve",
    )
}
