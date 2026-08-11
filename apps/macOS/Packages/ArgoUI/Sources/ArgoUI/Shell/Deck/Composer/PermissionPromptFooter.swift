import ArgoEngine
import SwiftUI

/// Allow focused, `⏎` allows, `esc` denies — and, on the trailing edge, the quieter third answer
/// the study drew: stop asking about this tool for the rest of this Session.
///
/// Quieter deliberately, and unbound to any key. It is the only answer here that outlives the call
/// it is given for, so it is the one answer that must not be reachable by muscle memory — and it
/// says its own scope in full (#572), because the version removed before merge said *here* over a
/// grant that covered every call to the tool.
struct PermissionPromptFooter: View {
    let toolName: String
    let decide: (PermissionDecision) -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            PermissionDecisionButton(answer: .allow) { decide(.allow) }
            PermissionDecisionButton(answer: .deny) { decide(.deny) }
            Spacer()
            StandingAllowOffer(toolName: toolName) { decide(.allowAlways) }
        }
        .argoText(ArgoTypography.control)
    }
}

/// The standing answer, as a line of text rather than a third pill: two pills and a third would
/// read as three equal answers, and this one is not equal to them.
private struct StandingAllowOffer: View {
    @Environment(\.argo) private var argo

    let toolName: String
    let stand: () -> Void

    var body: some View {
        Button(action: stand) {
            Text(StandingAllowProjection.offer(toolName))
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(StandingAllowProjection.offer(toolName))
    }
}

/// One of the two answers, drawn rather than taken from a stock button style.
///
/// Not a bespoke control for its own sake: the study's 27pt is taller than any `controlSize` the
/// platform offers, the ring belongs OUTSIDE the fill rather than on it, and a `.bordered` pill's
/// own ground resolves to within a couple of points of a glass vessel — which is a control the
/// reader has to already know is there. `Button` still owns the semantics and the keyboard.
private struct PermissionDecisionButton: View {
    @Environment(\.argo) private var argo

    let answer: Answer
    let act: () -> Void

    /// The two answers as a shape rather than as a pile of parameters, so the pair cannot be
    /// assembled into a third thing at a call site.
    enum Answer {
        case allow
        case deny
    }

    var body: some View {
        Button(action: act) {
            HStack(spacing: ArgoSpacing.tight) {
                Text(verb)
                PermissionKeycap(key: key)
            }
            .foregroundStyle(ink)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .frame(
                minWidth: ArgoComposerVessel.decisionMinimumWidth,
                minHeight: ArgoComposerVessel.decisionHeight,
            )
            .background(ground, in: shape)
            .overlay { shape.strokeBorder(border, lineWidth: ArgoStroke.border) }
            .overlay { focusRing }
        }
        .buttonStyle(.plain)
        .keyboardShortcut(answer == .allow ? .defaultAction : .cancelAction)
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }

    /// Drawn on Allow unconditionally, because Allow being focused is the state and not a thing
    /// that happens once the vessel is clicked: the prompt takes the composer's slot, and the
    /// reader arriving at it has to be able to answer with `⏎` without hunting for what has focus.
    @ViewBuilder private var focusRing: some View {
        if answer == .allow {
            shape
                .strokeBorder(argo.color.interaction.focusRing, lineWidth: ArgoStroke.focus)
                .padding(-(ArgoSpacing.hair + ArgoStroke.focus))
        }
    }

    private var verb: String {
        switch answer {
        case .allow: "Allow"
        case .deny: "Deny"
        }
    }

    private var key: String {
        switch answer {
        case .allow: "⏎"
        case .deny: "esc"
        }
    }

    private var ink: ArgoColor {
        switch answer {
        case .allow: argo.color.text.onAccent
        case .deny: argo.color.state.failure
        }
    }

    private var ground: ArgoColor {
        switch answer {
        case .allow: argo.color.interaction.accent
        case .deny: argo.color.surface.control
        }
    }

    /// Allow's ground is its own edge; Deny's has to be drawn, or the quieter answer is a word
    /// floating on the vessel rather than a control beside the loud one.
    private var border: ArgoColor {
        switch answer {
        case .allow: .transparent
        case .deny: argo.color.state.rim(argo.color.state.failure)
        }
    }
}

/// The key that answers, raised off the control it sits on rather than dimmed into it: a hint
/// ghosted to 60% reads as a label that has been disabled, which is the opposite of what it says.
private struct PermissionKeycap: View {
    @Environment(\.argo) private var argo

    let key: String

    var body: some View {
        Text(key)
            .argoText(ArgoTypography.machineCaption)
            .padding(.horizontal, ArgoSpacing.tight)
            .padding(.vertical, ArgoSpacing.hair)
            // `marked` is the contract's ground for a run of machine text, which is what a key
            // name is — and it is the one ground specified to keep its lift on whatever it lands
            // on, here an accent fill and a translucent pill.
            .background(argo.color.surface.marked, in: .rect(cornerRadius: ArgoRadius.marker))
    }
}

#Preview("Permission footer — the two answers and the standing one") {
    PermissionPromptFooter(toolName: "Bash", decide: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 480)
        .argoDeckSurface()
        .argoAppearance()
}
