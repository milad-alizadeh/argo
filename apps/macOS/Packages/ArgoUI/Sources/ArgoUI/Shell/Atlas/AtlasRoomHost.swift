import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas room and the rail beside it, over a reading handed to them — the shape the specimen
/// harness needs.
///
/// Both halves take their value off the environment (`argoAtlasRoom`), which a specimen has no way
/// to reach from outside the module. This puts one there, above the split view rather than on
/// either column, so the sidebar and the room read the same room the way the shell hands it to
/// them — and the rail draws on the platform's own sidebar material, which is the whole reason the
/// controls live there (#1161).
package struct AtlasRoomHost: View {
    private let reading: AtlasReading
    private let behind: Int?
    /// The file the room opens with open (#1154) — a specimen's only way to reach a state a click
    /// puts the room into. Nothing but a specimen ever passes one.
    private let opened: String?

    /// The room the strip in the rail is on. The strip switches the whole window in the app; here
    /// it has nowhere to go, and holds the room it opens in.
    @State private var cockpitRoom = CockpitRoom.atlas
    /// The reader's own channel choice, so a specimen can be DRIVEN — a picker bound to a constant
    /// draws the control and changes nothing when it is used.
    @State private var channels: AtlasChannels
    @State private var hideTests = false
    @State private var isCity = false

    /// `.unmeasured` is the Project nobody has measured, which is the room's other reading. Only a
    /// `.measured` reading draws `behind` at all (#1162); a specimen handing it in with another
    /// reading asserts nothing.
    package init(reading: AtlasReading, behind: Int? = nil, opened: String? = nil) {
        self.reading = reading
        self.behind = behind
        self.opened = opened
        _channels = State(initialValue: Self.opening(of: reading))
    }

    package var body: some View {
        NavigationSplitView {
            AtlasSidebar(cockpitRoom: $cockpitRoom)
                .navigationSplitViewColumnWidth(
                    min: ArgoLayout.sidebarMinimumWidth,
                    ideal: ArgoLayout.sidebarIdealWidth,
                    max: ArgoLayout.sidebarMaximumWidth,
                )
        } detail: {
            AtlasRoomView(opened: opened)
        }
        .environment(\.argoAtlasRoom, room)
    }

    private var room: AtlasRoom {
        AtlasRoom(
            reading: reading,
            project: CockpitPresentation.Project(
                id: "argo",
                name: "argo",
                location: "/Users/somebody/Developer/argo",
                isReachable: true,
                isRegistered: true,
            ),
            currency: AtlasCurrency(behind: behind) {},
            choice: AtlasMapChoice(
                channels: channels,
                setChannels: { channels = $0 },
                hideTests: AtlasSwitch(isOn: hideTests) { hideTests = $0 },
                isCity: AtlasSwitch(isOn: isCity) { isCity = $0 },
            ),
        )
    }

    /// The opening channels for whatever was handed in — and none at all for a reading that
    /// carries no Map, which is every vacancy: three empty menus over nothing measured would be
    /// controls naming Measures no repository stands behind.
    private static func opening(of reading: AtlasReading) -> AtlasChannels {
        guard case let .measured(map) = reading else { return AtlasChannels("") }
        return AtlasChannels.opening(for: map)
    }
}
