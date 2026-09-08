import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The Session's Model and Effort, set where they are stated (#558).
///
/// Harness and Effort are segmented choices. Models are a descriptive list, so the reader can
/// compare them before choosing one.
///
/// A section whose knob the adapter does not declare is OMITTED rather than drawn greyed
/// (acceptance criterion 4). A popover with both omitted is never reached: `RunFactsButton` draws
/// no trigger at all for it.
struct RunSettingsPopover: View {
    @Environment(\.argo) private var argo

    /// What this popover says and does — see `RunFactsControl`.
    let control: RunFactsControl

    var body: some View {
        Form {
            if facts.harness != nil {
                Section("Harness") { harnessControl }
            }
            // First, because it names what the rows below are about to draw a held mark on, and a
            // reader who opened the popover to see why a row did not tick needs the word before
            // the row (#1329).
            if let lockWords = control.lockWords {
                RunSettingsLock(words: lockWords)
            }
            if facts.chooses.model {
                Section("Model") { modelList }
            }
            if facts.chooses.effort {
                Section("Effort") { effortPicker }
            }
            if facts.harness != .codex {
                resetRow
            }
            if facts.harness == .codex, control.setHarness == nil {
                Text("Changes apply to the next Turn")
                    .argoText(ArgoTypography.caption)
            }
        }
        .formStyle(.grouped)
        .frame(width: ArgoRunSettings.width)
        .scrollContentBackground(.hidden)
    }

    static let harnessLockedWords = "you can't change harness during a session create a new session"

    private var harnessControl: some View {
        harnessPicker
            .disabled(control.setHarness == nil)
            .help(control.setHarness == nil ? Self
                .harnessLockedWords : "Choose the harness for this new Session")
    }

    private var harnessPicker: some View {
        HStack(spacing: ArgoSpacing.hair) {
            ForEach(AgentCLI.allCases, id: \.self) { cli in
                HarnessSegment(
                    harness: cli,
                    isSelected: facts.harness == cli,
                    select: { control.setHarness?(cli) },
                )
            }
        }
        .padding(ArgoSpacing.hair)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
    }

    private var modelList: some View {
        VStack(spacing: ArgoSpacing.hair) {
            ForEach(facts.models) { model in
                DescriptiveChoiceRow(
                    name: control.held.model == model.id ? "≈ \(model.name)" : model.name,
                    detail: model.note,
                    isSelected: model.id == modelSelection.wrappedValue,
                ) {
                    control.acts.setModel(model.id)
                }
            }
        }
    }

    private var modelSelection: Binding<String?> {
        Binding(
            get: { control.held.model ?? facts.tickedModel?.id },
            set: { picked in picked.map(control.acts.setModel) },
        )
    }

    private var effortPicker: some View {
        Picker("Effort", selection: effortSelection) {
            ForEach(facts.efforts, id: \.self) { rung in
                Text(rung.label).tag(Optional(rung))
            }
        }
        .pickerStyle(.segmented)
        .controlSize(.small)
        .labelsHidden()
    }

    /// It NAMES what it restores rather than saying "default", and it is inert while the values
    /// already are the default — a control that does nothing is not offered as though it might.
    ///
    /// The sentence names the rung it RESTORES TO and never the one the Session is on: this act
    /// sets Mode to Code, so a Session on Auto reading `Reset to Auto` would be the control lying
    /// about what pressing it does.
    private var resetRow: some View {
        Button(action: control.acts.reset) {
            Label(facts.resetWords, systemImage: ArgoSymbol.reset)
                .argoText(ArgoTypography.caption)
        }
        .buttonStyle(.plain)
        .disabled(isAtDefaults)
        .foregroundStyle(isAtDefaults ? argo.color.text.tertiary : argo.color.text.secondary)
    }

    private var isAtDefaults: Bool {
        facts.isDefault
    }

    private var facts: RunFacts {
        control.facts
    }

    private var effortSelection: Binding<SessionEffort?> {
        Binding(
            get: { control.held.effort ?? facts.effort.rung },
            set: { picked in picked.map(control.acts.setEffort) },
        )
    }
}

/// The popover's own measurement, held here rather than inline for the reason
/// `ArgoComposerVessel`'s are: it is the design's number, and a second spelling of it would drift.
enum ArgoRunSettings {
    /// 340pt, enough for every six-stop Effort scale without changing its control type.
    static let width: CGFloat = 340
}

@MainActor private func popover(_ facts: RunFacts) -> some View {
    RunSettingsPopover(control: RunFactsControl(facts: facts))
        .argoAppearance()
}

#Preview("Run settings — at the defaults, so the reset is inert") {
    popover(bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")))
}

#Preview("Run settings — off the defaults, so the reset names them") {
    popover(bothKnobs("claude-sonnet-5", .exactly(.xhigh, cli: "xhigh")))
}

// The read-back that acceptance criterion 2 is about: an id off Argo's table gets a row of its own
// so the tick has somewhere to land, and a level off the ladder ticks no segment at all.
#Preview("Run settings — a model and a level Argo does not recognise") {
    popover(bothKnobs("claude-mythos-7", .unknown(cli: "ludicrous")))
}

// One knob declared and not the other: the section is ABSENT, not greyed.
#Preview("Run settings — an adapter that chooses Effort alone") {
    popover(RunFacts(
        model: "claude-opus-5",
        effort: .exactly(.high, cli: "high"),
        chooses: RunFactKnobs(effort: true),
    ))
}

// The state #1329 is about: a Model picked mid-Turn stays live, said under the lock line and the
// held row's own `≈`, rather than the whole popover going inert (#1217's old picture).
#Preview("Run settings — a Model held until the Turn ends") {
    RunSettingsPopover(
        control: RunFactsControl(
            facts: bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")),
            held: RunFactsHeld(model: "claude-sonnet-5"),
        ),
    )
    .argoAppearance()
}
