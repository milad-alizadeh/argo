import ArgoDesign
import ArgoEngine
import SwiftUI

struct NewSessionComposer: View {
    let actions: CockpitActions.Sessions
    let menus: CockpitActions.Composer
    let beside: String?
    let started: (String) -> Void

    @State private var preparation: SessionPreparation?
    @State private var draft = ComposerDraft()
    @State private var refusal: String?
    @State private var isWorking = false

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            Text("New Session").argoText(ArgoTypography.body)
            Spacer()
            if let refusal {
                Text(refusal).argoText(ArgoTypography.caption)
            }
            if let preparation {
                PreparedSessionComposer(
                    preparation: preparation,
                    intents: intents,
                    firstSend: { Task { await send() } },
                    setHarness: { harness in Task { await choose(harness) } },
                )
                .disabled(isWorking)
            } else {
                ProgressView().controlSize(.small)
                if refusal != nil {
                    Button("Use Claude Code") { Task { await choose(.claude) } }
                        .argoText(ArgoTypography.body)
                    Button("Retry") { Task { await choose(nil) } }
                        .argoText(ArgoTypography.body)
                }
            }
        }
        .padding(ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
        .task { await choose(nil) }
    }

    private var intents: DeckIntents {
        DeckIntents(
            settings: SessionSettingIntents(
                setMode: { preparation?.mode = $0; remember() },
                setModel: { model in changeModel(model) },
                setEffort: { effort in changeEffort(effort) },
            ),
            commands: menus.skills,
            files: {
                guard let cwd = preparation?.cwd else { return [] }
                return await menus.workspaceFiles(cwd)
            },
            draft: $draft,
        )
    }

    private func choose(_ harness: AgentCLI?) async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        refusal = nil
        do {
            let mode = preparation?.mode
            var selected = try await actions.prepare(harness, beside)
            if let mode {
                selected.mode = mode
            }
            guard !Task.isCancelled else { return }
            preparation = selected
        } catch {
            refusal = AgentRefusal.detail(of: error)
        }
    }

    private func changeModel(_ model: String) {
        guard let selected = preparation,
              let run = selected.catalog.resolve(SessionRun(
                  model: model,
                  effort: selected.run.effort,
              ))
        else { return }
        preparation?.run = run
        remember()
    }

    private func changeEffort(_ effort: SessionEffort) {
        guard let selected = preparation else { return }
        preparation?.run = SessionRun(model: selected.run.model, effort: effort)
        remember()
    }

    private func remember() {
        if let preparation {
            actions.remember(preparation)
        }
    }

    private func send() async {
        guard draft.isSendable, !isWorking, let preparation else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            let attachments = preparation.harness == .claude ? draft.attachments : ComposerMentions
                .attaching(
                    draft.attachments,
                    for: draft.text,
                    within: preparation.cwd,
                )
            let id = try await actions.start(preparation, draft.text, attachments, beside)
            started(id)
        } catch {
            refusal = AgentRefusal.detail(of: error)
        }
    }
}
