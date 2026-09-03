import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The Session's Model and Effort, set where they are stated (#558).
///
/// **Two `Form` sections and no second layer.** Model is an inline list because three names fit and
/// a pop-up button's menu overflowed the popover's right edge and covered the Effort row — nothing
/// here opens on top of anything. Effort is segmented because it is ORDERED rather than a set of
/// equals, which is what makes it a scale.
///
/// **Mode is not repeated here.** It is on the footer beside the trigger, where it is read without
/// opening anything (design decision 1) — and a value stated in two places is one you keep in sync
/// by eye. It appears in exactly one sentence: the reset's, which names what it restores.
///
/// A section whose knob the adapter does not declare is OMITTED rather than drawn greyed
/// (acceptance criterion 4). A popover with both omitted is never reached: `RunFactsButton` draws
/// no trigger at all for it.
struct RunSettingsPopover: View {
    @Environment(\.argo) private var argo

    /// What this popover says and does — see `RunFactsControl`.
    let control: RunFactsControl
    /// Read for the reset's sentence alone; Mode itself is never drawn here (decision 1).
    let mode: SessionModeReading

    var body: some View {
        Form {
            if facts.chooses.model {
                Section("Model") { models }
            }
            if facts.chooses.effort {
                Section("Effort") { efforts }
            }
            resetRow
        }
        .formStyle(.grouped)
        // The design's own number. Held rather than hugged: the Effort scale's five segments and
        // the Model rows' trailing notes would otherwise size the popover off whichever is longer.
        .frame(width: ArgoRunSettings.width)
        .scrollContentBackground(.hidden)
    }

    /// Rows with a checkmark, drawn rather than picked (#558).
    ///
    /// Buttons and not the `Picker(.inline)` the design names, because inside a grouped `Form`
    /// that control draws RADIO BUTTONS and re-synthesises each row from its tag's label alone:
    /// neither the checkmark nor the trailing note survives it.
    private var models: some View {
        ForEach(facts.models) { model in
            Button { control.acts.setModel(model.id) } label: { row(model) }
                .buttonStyle(.plain)
                .accessibilityAddTraits(model == facts.tickedModel ? [.isSelected] : [])
        }
    }

    /// The tick, the name, and the note the design sets beside it. A Session whose records have
    /// named no model ticks NOTHING rather than the first row, for the reason an inexact Mode
    /// reading ticks nothing (#545) — and the mark's SPACE is held either way, so the names do not
    /// shift when the tick moves.
    private func row(_ model: RunFactsModel) -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.chosen, .inline)
                .foregroundStyle(argo.color.interaction.accent)
                .opacity(model == facts.tickedModel ? 1 : 0)
            Text(model.name).argoText(ArgoTypography.body)
            Spacer(minLength: ArgoSpacing.base)
            Text(model.note)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
        }
        // Or only the words take the click, and the gap between name and note does nothing.
        .contentShape(Rectangle())
    }

    /// Five stops, not the four the approved design drew — `claude --effort` documents
    /// `low, medium, high, xhigh, max`, and a four-stop control could not set a value the CLI can
    /// be on. See the amended-in-build note on `cockpit-session-composer.md`.
    private var efforts: some View {
        Picker("Effort", selection: effortSelection) {
            ForEach(SessionEffort.allCases, id: \.self) { rung in
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
            Label(RunFacts.resetWords, systemImage: ArgoSymbol.reset)
                .argoText(ArgoTypography.caption)
        }
        .buttonStyle(.plain)
        .disabled(isAtDefaults)
        .foregroundStyle(isAtDefaults ? argo.color.text.tertiary : argo.color.text.secondary)
    }

    /// Whether there is anything left for the reset to do. All THREE, because it sets all three:
    /// inertness read off Model and Effort alone would draw a dead button on a Session sitting on
    /// Auto, whose Mode this act would very much have moved.
    private var isAtDefaults: Bool {
        facts.isDefault && mode.rung == RunFacts.defaultMode
    }

    /// What this popover says, unwrapped once so the body above reads as the design does.
    private var facts: RunFacts {
        control.facts
    }

    private var effortSelection: Binding<SessionEffort?> {
        Binding(get: { facts.effort.rung }, set: { picked in picked.map(control.acts.setEffort) })
    }
}

/// The popover's own measurement, held here rather than inline for the reason
/// `ArgoComposerVessel`'s are: it is the design's number, and a second spelling of it would drift.
enum ArgoRunSettings {
    /// 264pt, off `cockpit-session-composer.md`.
    static let width: CGFloat = 264
}

@MainActor private func popover(_ facts: RunFacts, mode: SessionMode = .code) -> some View {
    RunSettingsPopover(
        control: RunFactsControl(facts: facts),
        mode: .exactly(mode, cli: "acceptEdits"),
    )
    .argoAppearance()
}

#Preview("Run settings — at the defaults, so the reset is inert") {
    popover(bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")))
}

#Preview("Run settings — off the defaults, so the reset names them") {
    popover(bothKnobs("claude-sonnet-5", .exactly(.xhigh, cli: "xhigh")), mode: .auto)
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
