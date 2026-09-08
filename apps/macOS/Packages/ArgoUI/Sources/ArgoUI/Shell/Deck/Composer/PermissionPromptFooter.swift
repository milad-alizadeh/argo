import ArgoAtoms
import ArgoDesign
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
            StandingAllowOffer(toolName: toolName) { decide(.allowAlways) }
            Spacer()
            PermissionDecisionButton(answer: .deny) { decide(.deny) }
        }
        .argoText(ArgoTypography.control)
    }
}

/// The standing answer as the third visible decision. It keeps the full scope in its words: this
/// gate can remember a tool for this Session, while Claude's own prompt may offer a narrower rule.
private struct StandingAllowOffer: View {
    @Environment(\.argo) private var argo

    let toolName: String
    let stand: () -> Void

    var body: some View {
        Button(action: stand) {
            Text(StandingAllowProjection.offer(toolName))
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.secondary)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .frame(minHeight: ArgoComposerVessel.decisionHeight)
                .background(argo.color.surface.control, in: shape)
                .overlay {
                    shape.strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.border)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(StandingAllowProjection.offer(toolName))
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }
}

/// One of the two answers, drawn rather than taken from a stock button style: the study's 27pt is
/// taller than any `controlSize` the platform offers. The neutral fill stays inside the amber
/// Permission language, while `Button` still owns the semantics and the keyboard.
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
                Text(key)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .foregroundStyle(ink)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .frame(
                minWidth: ArgoComposerVessel.decisionMinimumWidth,
                minHeight: ArgoComposerVessel.decisionHeight,
            )
            .background(ground, in: shape)
            .overlay { shape.strokeBorder(border, lineWidth: ArgoStroke.border) }
        }
        .buttonStyle(.plain)
        .keyboardShortcut(answer == .allow ? .defaultAction : .cancelAction)
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
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
        case .allow: argo.color.text.primary
        case .deny: argo.color.text.secondary
        }
    }

    private var ground: ArgoColor {
        argo.color.surface.control
    }

    /// The default action carries the vessel's attention color; Deny stays neutral on the far edge.
    private var border: ArgoColor {
        switch answer {
        case .allow: argo.color.state.rim(argo.color.state.attention)
        case .deny: argo.color.edge.hairline
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
