import SwiftUI

/// What the ⓘ beside `CONTEXT` opens: the two lines named, with the ink each of them turns the
/// reading, and what the remedy actually does.
///
/// It **explains and does not report.** The reading is two inches away and unmissable; a panel that
/// repeated it would be the same fact twice with two chances to disagree, and it would make the
/// panel worth opening once per Session rather than once ever (#502, story 42). Nothing here is
/// per-Session for the same reason — the thresholds are Argo's own policy, so the panel is the
/// same panel over every header.
extension SessionHeaderProjection.Context {
    /// One policy line, said the way the panel says it.
    struct GuideLine: Equatable, Sendable, Identifiable {
        /// `past 150k` — the threshold, not the Session's distance from it.
        let threshold: String
        let meaning: String
        /// Which ink the line is set in, so the panel decodes the colour by WEARING it rather than
        /// by naming it. A legend that spelled "amber" would be a second vocabulary to keep in step
        /// with the palette, and unreadable to anybody who cannot tell the two hues apart anyway.
        let tier: Tier

        var id: String {
            threshold
        }
    }

    static let guide: [GuideLine] = [
        GuideLine(
            threshold: "past \(TokenCount.short(SessionHeaderProjection.ContextPolicy.warn))",
            meaning: "handing off is worth doing",
            tier: .warn,
        ),
        GuideLine(
            threshold: "past \(TokenCount.short(SessionHeaderProjection.ContextPolicy.crit))",
            meaning: "handing off is overdue",
            tier: .crit,
        ),
    ]

    /// Why the lines are where they are, and what the remedy is. It names Hand off as a thing that
    /// exists rather than as a control on this header: the button is #513's, and a panel promising
    /// one before it is built would send somebody looking for it.
    static let remedy = """
    A long context makes an agent slower and less accurate. Handing off runs /handoff in the \
    Session, then opens a fresh one on the same branch and issue, so the work continues rather \
    than restarting.
    """
}

struct SessionContextGuide: View {
    @Environment(\.argo) private var argo

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            ForEach(SessionHeaderProjection.Context.guide) { line in
                self.line(line)
            }
            Text(SessionHeaderProjection.Context.remedy)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ArgoSpacing.loose)
        .frame(width: ArgoLayout.contextGuideWidth, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("About the context reading")
    }

    private func line(_ line: SessionHeaderProjection.Context.GuideLine) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.base) {
            Text(line.threshold)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(line.tier.tint(in: argo.color))
                .frame(width: ArgoLayout.contextGuideThresholdWidth, alignment: .leading)
            Text(line.meaning)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
        }
    }
}

#Preview("Context guide — the two lines, decoded once") {
    SessionContextGuide()
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
