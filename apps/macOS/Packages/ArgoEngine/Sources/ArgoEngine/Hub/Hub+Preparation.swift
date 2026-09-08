import Foundation

public extension Hub {
    func prepareSession(harness: AgentCLI? = nil) async throws -> SessionPreparation {
        let harness = harness ?? runStore.lastHarness()
        let catalog: SessionRunCatalog = switch harness {
        case .claude: .claude
        case .codex:
            try await CodexModelReader().read(
                launcher: spawnServices.launcher,
                cwd: project.url.path,
            )
        }
        guard let fallback = catalog.defaultRun,
              let run = catalog.resolve(runStore.lastPicked(for: harness, fallback: fallback))
        else {
            throw AgentSpawnError.hostRefused(detail: "No models are available for this harness")
        }
        runStore.rememberHarness(harness)
        return SessionPreparation(
            harness: harness,
            catalog: catalog,
            run: run,
            mode: modeStore.lastPicked(),
        )
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
    }
}

extension Hub {
    func rememberRun(_ pick: SessionRunPick, for sessionID: String) {
        if let thread = adapters.codex.thread(for: sessionID), let run = thread.run {
            runStore.remember(.model(run.model), for: .codex, fallback: run)
            runStore.remember(.effort(run.effort), for: .codex, fallback: run)
        } else {
            runStore.remember(pick)
        }
    }
}
