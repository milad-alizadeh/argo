import SwiftUI

/// The panel the ⓘ opens: the budget legend, which EXPLAINS Argo's policy, then the block that
/// REPORTS what this Session reads (#694).
struct SessionContextGuide: View {
    @Environment(\.argo) private var argo

    /// The Session's own facts, already composed. Never empty: the context reading is always one
    /// row, said as `unknown` where it cannot be read.
    let facts: [SessionHeaderProjection.Fact]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            section("Context budget") {
                ForEach(SessionHeaderProjection.Context.guide) { line in
                    self.line(line)
                }
            }
            Text(SessionHeaderProjection.Context.remedy)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
                .fixedSize(horizontal: false, vertical: true)
            DeckSeparator()
            section("This Session") {
                ForEach(facts) { fact in
                    row(fact)
                }
            }
        }
        .padding(ArgoSpacing.loose)
        .frame(width: ArgoLayout.contextGuideWidth, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("About the context reading")
    }

    /// A heading over its rows. The capitals are the type's treatment, not the string's.
    private func section(
        _ words: String,
        @ViewBuilder rows: () -> some View,
    )
        -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            Text(words)
                .argoText(ArgoTypography.badge)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
            VStack(alignment: .leading, spacing: ArgoSpacing.snug, content: rows)
        }
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

    /// The reading WRAPS rather than truncating: a branch or an issue title is what a reader opened
    /// the panel to read whole.
    private func row(_ fact: SessionHeaderProjection.Fact) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.base) {
            Text(fact.term)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoLayout.contextGuideTermWidth, alignment: .leading)
            Text(fact.value)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        // One element per row: read column by column, a term and its reading are two lists.
        .accessibilityElement(children: .combine)
    }
}

#Preview("Context guide — the policy, then what this Session reads") {
    SessionContextGuide(facts: SessionHeaderFixture.guided.facts)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Context guide — a Session almost nothing could be read off") {
    SessionContextGuide(facts: SessionHeaderFixture.unguided.facts)
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
