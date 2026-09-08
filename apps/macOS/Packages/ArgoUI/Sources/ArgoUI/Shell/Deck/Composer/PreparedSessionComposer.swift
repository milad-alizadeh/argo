import ArgoEngine
import SwiftUI

struct PreparedSessionComposer: View {
    let preparation: SessionPreparation
    let intents: DeckIntents
    let firstSend: () -> Void
    let setHarness: (AgentCLI) -> Void

    var body: some View {
        var composer = SessionComposer(composer: projection, intents: intents)
        composer.firstSend = firstSend
        composer.setHarness = setHarness
        return composer
    }

    private var projection: SessionComposerProjection.Composer {
        SessionComposerProjection.Composer(
            sessionID: "new-session", placeholder: "Message \(preparation.harness.readableName)…",
            facts: facts, permission: preparation.permission, standingAllows: [], isRunning: false,
            mode: .exactly(preparation.mode, cli: preparation.permission.selectedID ?? "unknown"),
            modeDidNotTake: nil, lostTurn: nil, canAttach: true,
            canRunCommands: preparation.harness == .claude,
            resolvesMentions: preparation.harness == .claude,
            workspaceRoot: preparation.cwd,
        )
    }

    private var facts: RunFacts {
        var facts = RunFacts(
            model: preparation.run.model,
            effort: .exactly(preparation.run.effort, cli: preparation.run.effort.rawValue),
            chooses: .both,
        )
        facts.harness = preparation.harness
        facts.catalog = preparation.catalog
        return facts
    }
}
