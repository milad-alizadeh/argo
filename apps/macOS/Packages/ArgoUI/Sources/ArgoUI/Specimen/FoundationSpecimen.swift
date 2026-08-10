import SwiftUI

/// The visual contract, shown on the surfaces it exists for.
///
/// Not the shell — #376/#377/#378 build that. This is the judgeable form of #375: the
/// palette, type and motion roles dressed onto a real `NavigationSplitView`, so the sidebar
/// is the system's Liquid Glass and the room and Git controls are the system's toolbar
/// vessels. Nothing here re-implements a native control, and nothing holds a value of its
/// own — every colour, size and duration comes from the contract.
public struct FoundationSpecimen: View {
    @State private var selection: CockpitPresentation.Session.ID? = CockpitPresentation.preview
        .sessions.first?.id
    @State private var room = SpecimenFixtures.Room.sessions
    @State private var tab = SpecimenFixtures.DeckTab.activity

    public init() {}

    public var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("Sessions") {
                    ForEach(SessionRosterProjection.previewRows) { row in
                        SessionRow(row: row).previewSafeListRow().tag(row.id)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 260, ideal: 300, max: 380)
        } detail: {
            SpecimenDeck(session: selected, tab: $tab)
        }
        // The window title is the Project. The Session's title is the deck's headline —
        // saying it twice is what makes a top bar read as a band.
        .navigationTitle("argo")
        .toolbar { toolbar }
        .argoAppearance()
    }

    /// Rooms and Git: the only two vessels, with the spacer between them keeping them two
    /// rather than one long bar.
    ///
    /// Rooms is the stock segmented `Picker` and stays that way. Liquid Glass on a segmented
    /// picker is applied by the system *during interaction* — press and drag and the
    /// selection turns to glass — so it reads flat at rest, and a resting screenshot is not
    /// evidence that it is missing.
    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Picker("Room", selection: $room) {
                ForEach(SpecimenFixtures.Room.allCases) { candidate in
                    Label(candidate.title, systemImage: candidate.symbol).tag(candidate)
                }
            }
            .pickerStyle(.segmented)
            .labelStyle(.titleAndIcon)
        }
        ToolbarSpacer(.flexible, placement: .principal)
        ToolbarItem(placement: .principal) {
            Menu {
                Button("Checkout…") {}
                Button("Fetch") {}
            } label: {
                // A toolbar control has to say something; the roster's own answer to a
                // branchless Session is to draw no line at all, which a menu label cannot do.
                Label(selected.branch ?? "unknown", systemImage: "arrow.trianglehead.branch")
                    .labelStyle(.titleAndIcon)
            }
        }
    }

    private var selected: CockpitPresentation.Session {
        CockpitPresentation.preview.sessions.first { $0.id == selection }
            ?? .preview
    }
}

#Preview("Cockpit surfaces") {
    FoundationSpecimen()
        .frame(width: 1280, height: 800)
}
