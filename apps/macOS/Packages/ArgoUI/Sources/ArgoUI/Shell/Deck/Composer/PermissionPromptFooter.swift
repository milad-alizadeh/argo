import ArgoEngine
import SwiftUI

/// Allow focused, `⏎` allows, `esc` denies — and, on the trailing edge, the quieter third answer:
/// stop asking about this tool for the rest of this Session. The third is bound to no key, being
/// the only answer that outlives the call it is given for (#572).
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

/// The standing answer, as a line of text rather than a third pill.
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

/// One of the two answers, drawn rather than taken from a stock button style: the study's 27pt is
/// taller than any `controlSize` the platform offers, the ring belongs OUTSIDE the fill, and a
/// `.bordered` pill's own ground resolves to within a couple of points of a glass vessel. `Button`
/// still owns the semantics and the keyboard.
private struct PermissionDecisionButton: View {
    @Environment(\.argo) private var argo

    let answer: Answer
    let act: () -> Void

    enum Answer {
        case allow
        case deny
    }

    var body: some View {
        Button(action: act) {
            HStack(spacing: ArgoSpacing.tight) {
                Text(verb)
                DeckKeycap(key: key)
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

    /// Drawn on Allow unconditionally: Allow being focused is the state, not something that happens
    /// once the vessel is clicked, and `⏎` answers from the moment the prompt appears.
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

    /// Allow's ground is its own edge; Deny's has to be drawn.
    private var border: ArgoColor {
        switch answer {
        case .allow: .transparent
        case .deny: argo.color.state.rim(argo.color.state.failure)
        }
    }
}

#Preview("Permission footer — the two answers and the standing one") {
    PermissionPromptFooter(toolName: "Bash", decide: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 480)
        .argoDeckSurface()
        .argoAppearance()
}
