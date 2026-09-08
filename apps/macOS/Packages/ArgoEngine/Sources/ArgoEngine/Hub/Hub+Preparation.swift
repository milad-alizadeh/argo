import Foundation

public extension Hub {
    func prepareSession(
        harness: AgentCLI? = nil,
        beside sessionID: String? = nil,
    ) async throws
        -> SessionPreparation {
        let harness = harness ?? runStore.lastHarness()
        let catalog: SessionRunCatalog = switch harness {
        case .claude: await claudeCatalog()
        case .codex:
            try await spawnServices.readCodexModels(spawnServices.launcher, project.url.path)
        }
        guard let fallback = catalog.defaultRun,
              let run = catalog.resolve(runStore.lastPicked(for: harness, fallback: fallback))
        else {
            throw AgentSpawnError.hostRefused(detail: "No models are available for this harness")
        }
        runStore.rememberHarness(harness)
        var permission = adapters.permissionProfile(
            for: modeStore.lastPicked(),
            harness: harness,
        )
        if let remembered = runStore.lastPermission(for: harness) {
            _ = permission.select(remembered)
        }
        var preparation = SessionPreparation(
            harness: harness,
            catalog: catalog,
            run: run,
            permission: permission,
        )
        preparation.cwd = sessionID.flatMap { id in
            sessions.first(where: { $0.id == id })?.cwd
        } ?? project.url.path
        return preparation
    }

    func startPreparedSession(
        _ preparation: SessionPreparation,
        text: String,
        attachments: [SessionAttachment],
        beside sessionID: String? = nil,
    ) async throws
        -> String {
        guard SessionTurn.isSendable(text) || !attachments.isEmpty
        else { throw SessionDriveError.nothingToSend }
        guard preparation.catalog.resolve(preparation.run) == preparation.run else {
            throw SessionDriveError.runFactsUnsupported
        }
        let cwd: String?
        if let sessionID {
            guard let session = sessions.first(where: { $0.id == sessionID }),
                  let folder = session.cwd
            else { throw SessionDriveError.notDrivable }
            cwd = folder
        } else {
            cwd = nil
        }
        let paths = try AttachmentStore(root: Self.attachmentRoot).address(
            attachments,
            of: UUID().uuidString,
        )
        var seed = SessionSeed(
            cwd: cwd,
            opening: SessionTurn.text(text, attaching: paths),
            mode: preparation.mode,
        )
        seed.permission = preparation.permission.selected
        seed.run = preparation.run
        seed.catalog = preparation.catalog
        seed.images = zip(attachments, paths).filter(\.0.isImage).map(\.1)
        let claim = try await spawnSession(cli: preparation.harness, seed: seed)
        rememberPreparation(preparation)
        return claim.value
    }

    func rememberPreparation(_ preparation: SessionPreparation) {
        runStore.rememberHarness(preparation.harness)
        runStore.remember(
            .model(preparation.run.model),
            for: preparation.harness,
            fallback: preparation.run,
        )
        runStore.remember(
            .effort(preparation.run.effort),
            for: preparation.harness,
            fallback: preparation.run,
        )
        modeStore.remember(preparation.mode)
        if let permissionID = preparation.permission.selectedID {
            runStore.rememberPermission(permissionID, for: preparation.harness)
        }
    }
}

extension Hub {
    func rememberPermission(_ id: String, for sessionID: String) {
        let harness: AgentCLI = adapters.codex.thread(for: sessionID) == nil ? .claude : .codex
        runStore.rememberPermission(id, for: harness)
    }

    func rememberRun(_ pick: SessionRunPick, for sessionID: String) {
        if let thread = adapters.codex.thread(for: sessionID), let run = thread.run {
            runStore.remember(.model(run.model), for: .codex, fallback: run)
            runStore.remember(.effort(run.effort), for: .codex, fallback: run)
        } else {
            runStore.remember(pick)
        }
    }
}

extension Hub {
    func configuredSeed(_ seed: SessionSeed, for harness: AgentCLI) async throws -> SessionSeed {
        guard seed.catalog == nil else { return seed }
        let catalog: SessionRunCatalog = switch harness {
        case .claude: await claudeCatalog()
        case .codex:
            try await spawnServices.readCodexModels(
                spawnServices.launcher, seed.cwd ?? project.url.path,
            )
        }
        guard let fallback = catalog.defaultRun else { throw SessionDriveError.runFactsUnsupported }
        let remembered = runStore.lastPicked(for: harness, fallback: fallback)
        var seed = seed
        seed.catalog = catalog
        if let resuming = seed.resuming {
            seed.run = run(resuming: resuming.sessionID)
        } else {
            seed.run = catalog.resolve(seed.run ?? remembered)
        }
        return seed
    }

    private func claudeCatalog() async -> SessionRunCatalog {
        await (try? spawnServices.readClaudeModels()) ?? .claude
    }
}
