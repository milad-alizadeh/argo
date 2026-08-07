import SwiftUI

/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but Xcode is the only thing that can draw one, and a
/// screenshot is the only evidence a visual claim can be checked against. This catalog addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — which for most of them is not possible at all, since the app
/// launched against an ordinary checkout shows no Sessions.
///
/// Add a case here and it is renderable; `scripts/specimens.sh` reads the list out of this file
/// rather than repeating it.
public enum Specimen: String, CaseIterable, Sendable {
    case foundations
    case contract
    case sessionRows
    case deck
}

/// One catalog entry filling the window. No per-case frame: a state is judged at the width the app
/// actually gives it.
public struct SpecimenScreen: View {
    private let specimen: Specimen

    public init(specimen: Specimen) {
        self.specimen = specimen
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .argoAppearance()
    }

    @ViewBuilder private var content: some View {
        switch specimen {
        case .foundations:
            FoundationSpecimen()
        case .contract:
            ContractSpecimen()
        case .sessionRows:
            SessionRowsSpecimen()
        case .deck:
            DeckSpecimen()
        }
    }
}

/// Every operational state a roster row can be in, in one column.
private struct SessionRowsSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(SpecimenFixtures.roster) { session in
                SpecimenSessionRow(session: session)
            }
        }
        .padding(ArgoSpacing.section)
    }
}

/// The deck specimen, holding the tab selection it needs to draw.
private struct DeckSpecimen: View {
    @State private var tab = SpecimenFixtures.DeckTab.activity

    var body: some View {
        SpecimenDeck(session: SpecimenFixtures.roster[0], tab: $tab)
    }
}

#Preview("Specimen — the deck") {
    SpecimenScreen(specimen: .deck)
        .frame(width: 1000, height: 620)
}
