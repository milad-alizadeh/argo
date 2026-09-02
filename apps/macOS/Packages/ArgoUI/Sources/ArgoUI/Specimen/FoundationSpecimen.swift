import ArgoDesign
import SwiftUI

/// The visual contract dressed onto a real `NavigationSplitView`, so the sidebar is the system's
/// Liquid Glass and the room and Git controls are the system's toolbar vessels (#375). Not the
/// shell — #376/#377/#378 build that. Nothing here re-implements a native control, and nothing
/// holds a value of its own.
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
        // The window title is the Project; the Session's title is the deck's headline.
        .navigationTitle("argo")
        .toolbar { toolbar }
        .argoAppearance()
    }

    /// Rooms and Git: the only two vessels, kept two by the spacer between them.
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
                // The word `GitVessel` degrades an unnameable checkout to. The roster's own
                // answer — draw no line — is not open to a control that must be labelled.
                Label(
                    selected.workspace?.branch ?? "unknown",
                    systemImage: "arrow.trianglehead.branch",
                )
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
