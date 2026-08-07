import SwiftUI

/// The Instrument Deck: opaque by contract, so it reads as ground against the sidebar's
/// glass. Specimen only — #378 owns the real deck and #379–#382 fill it.
struct SpecimenDeck: View {
    @Environment(\.argo) private var argo

    let session: SpecimenFixtures.Session
    @Binding var tab: SpecimenFixtures.DeckTab

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView {
                LazyVStack(alignment: .leading, spacing: ArgoSpacing.loose) {
                    ForEach(SpecimenFixtures.feed) { entry in
                        SpecimenFeedEntry(entry: entry)
                    }
                }
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.vertical, ArgoSpacing.section)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .argoDeckSurface()
    }

    /// The one place the serif carries a whole line, with the machine facts in mono beside
    /// it — the two families doing the two jobs the contract gives them.
    private var header: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.comfortable) {
                Text(session.title)
                    .argoText(ArgoTypography.sessionTitle)
                Spacer(minLength: ArgoSpacing.loose)
                HStack(spacing: ArgoSpacing.comfortable) {
                    Label(session.branch, systemImage: "arrow.trianglehead.branch")
                        .argoText(ArgoTypography.machine)
                    Text(session.elapsed).argoText(ArgoTypography.machine)
                }
                .foregroundStyle(argo.color.text.tertiary)
            }
            SpecimenDeckTabs(selection: $tab)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .padding(.top, ArgoSpacing.loose)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) {
            Divider().overlay(argo.color.edge.hairline)
        }
    }
}

/// Attached text tabs. Deliberately not a segmented `Picker`: #378 rules out a pill or a
/// glass control here, and the selected edge is the same Ion Blue rule the sidebar uses.
struct SpecimenDeckTabs: View {
    @Environment(\.argo) private var argo

    @Binding var selection: SpecimenFixtures.DeckTab

    var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            ForEach(SpecimenFixtures.DeckTab.allCases) { tab in
                Button { selection = tab } label: {
                    Text(tab.title)
                        .argoText(ArgoTypography.control)
                        .foregroundStyle(
                            selection == tab ? argo.color.text.primary : argo.color.text.tertiary,
                        )
                        .padding(.bottom, ArgoSpacing.base)
                        .overlay(alignment: .bottom) { indicator(for: tab) }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == tab ? [.isSelected, .isButton] : .isButton)
            }
        }
        .argoAnimation(.selection, value: selection)
    }

    @ViewBuilder private func indicator(for tab: SpecimenFixtures.DeckTab) -> some View {
        if selection == tab {
            Rectangle()
                .fill(argo.color.interaction.selectionIndicator)
                .frame(height: ArgoStroke.indicator)
        }
    }
}

/// One entry in the chronological feed. Prose in SF Pro, the machine fact under it in SF
/// Mono on the raised surface — the separation the whole type contract exists for.
struct SpecimenFeedEntry: View {
    @Environment(\.argo) private var argo

    let entry: SpecimenFixtures.FeedEntry

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            HStack(spacing: ArgoSpacing.base) {
                Image(systemName: entry.symbol)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(argo.color.text.tertiary)
                Text(entry.prose).argoText(ArgoTypography.body)
                Spacer(minLength: ArgoSpacing.base)
                Text(entry.at)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            if let evidence = entry.evidence {
                Text(evidence)
                    .argoText(ArgoTypography.machine)
                    .foregroundStyle(argo.color.text.secondary)
                    .textSelection(.enabled)
                    .padding(ArgoSpacing.comfortable)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .fill(argo.color.surface.raised)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.hairline)
                    }
            }
        }
    }
}

#Preview("Instrument Deck") {
    @Previewable @State var tab = SpecimenFixtures.DeckTab.activity

    SpecimenDeck(session: SpecimenFixtures.roster[0], tab: $tab)
        .frame(width: 860, height: 620)
        .argoAppearance()
}
