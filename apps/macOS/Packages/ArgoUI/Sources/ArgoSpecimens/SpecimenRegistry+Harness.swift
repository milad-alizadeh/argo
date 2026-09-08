import ArgoEngine
import ArgoUI

extension SpecimenRegistry {
    static let harnessSettings: [SpecimenEntry] = [
        SpecimenEntry("newSessionDraft") { NewSessionDraftSpecimen(state: .ready) },
        SpecimenEntry("newSessionLoading") { NewSessionDraftSpecimen(state: .loading) },
        SpecimenEntry("newSessionUnavailable") { NewSessionDraftSpecimen(state: .unavailable) },
        SpecimenEntry("composerHarnessClaudeDraft") { harness(.claude, editable: true) },
        SpecimenEntry("composerHarnessCodexDraft") { harness(.codex, editable: true) },
        SpecimenEntry("composerHarnessLocked") { harness(.codex, editable: false) },
        SpecimenEntry("composerPermissionClaude") {
            harness(.claude, editable: false, opening: .permission)
        },
        SpecimenEntry("composerPermissionCodex") {
            harness(.codex, editable: false, opening: .permission)
        },
    ]

    private static func harness(
        _ harness: AgentCLI,
        editable: Bool,
        opening: ComposerMenusOpening = .runSettings,
    )
        -> ComposerSpecimen {
        let catalog: SessionRunCatalog = harness == .claude ? .claude : codexModels
        let run = catalog.defaultRun ?? .unpicked
        var facts = RunFacts(
            model: run.model,
            effort: .exactly(run.effort, cli: run.effort.rawValue),
            chooses: .both,
        )
        facts.harness = harness
        facts.catalog = catalog
        let composer = SessionComposerProjection.Composer(
            sessionID: "harness-example", placeholder: "Message \(harness.readableName)…",
            facts: facts, permission: specimenPermissionProfile(harness),
            standingAllows: [], isRunning: !editable,
            mode: .exactly(.code, cli: "acceptEdits"), modeDidNotTake: nil, lostTurn: nil,
            canAttach: true, canRunCommands: harness == .claude,
        )
        var specimen = ComposerSpecimen(composer: composer, opening: opening)
        specimen.harnessEditable = editable
        return specimen
    }

    /// The installed app-server's model/list on 2026-09-08; renders never query the user's account.
    private static let codexModels = SessionRunCatalog(models: [
        .init(
            id: "gpt-6-astra",
            name: "GPT-6 Astra",
            detail: "For complex, demanding work",
            efforts: [.low, .medium, .high, .xhigh, .max, .ultra],
            defaultEffort: .medium,
        ),
        .init(
            id: "gpt-5.6-sol",
            name: "GPT-5.6-Sol",
            detail: "Reliable agentic workhorse for everyday tasks",
            efforts: [.low, .medium, .high, .xhigh, .max, .ultra],
            defaultEffort: .low,
            isDefault: true,
        ),
        .init(
            id: "gpt-5.6-terra",
            name: "GPT-5.6-Terra",
            detail: "Balanced coding model for everyday work",
            efforts: [.low, .medium, .high, .xhigh, .max, .ultra],
            defaultEffort: .medium,
        ),
        .init(
            id: "gpt-5.6-luna",
            name: "GPT-5.6-Luna",
            detail: "Fast and affordable coding model",
            efforts: [.low, .medium, .high, .xhigh, .max],
            defaultEffort: .medium,
        ),
        .init(
            id: "gpt-5.5",
            name: "GPT-5.5",
            detail: "Proven previous-generation coding model",
            efforts: [.low, .medium, .high, .xhigh],
            defaultEffort: .medium,
        ),
        .init(
            id: "gpt-5.4-mini",
            name: "GPT-5.4-Mini",
            detail: "Small, fast model for simpler tasks",
            efforts: [.low, .medium, .high, .xhigh],
            defaultEffort: .medium,
        ),
        .init(
            id: "gpt-5.3-codex-spark",
            name: "GPT-5.3-Codex-Spark",
            detail: "Ultra-fast coding model",
            efforts: [.low, .medium, .high, .xhigh],
            defaultEffort: .high,
        ),
    ])
}
