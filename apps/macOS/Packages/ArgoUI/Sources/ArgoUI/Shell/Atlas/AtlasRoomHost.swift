import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas room and the rail beside it, over a reading handed to them — the shape the specimen
/// harness needs.
///
/// The room half takes its value off the environment (`argoAtlasRoom`), which a specimen has no
/// way to reach from outside the module, so this puts one there; the rail half is HANDED its room,
/// the way the shell hands one to its own leading column (#1489). Both are built from the same
/// state below, so the two halves say the same thing about what was measured — and the rail draws
/// on the platform's own sidebar material, which is the whole reason the controls live there
/// (#1161).
package struct AtlasRoomHost: View {
    private let reading: AtlasReading
    private let behind: Int?
    /// What the room opens already in — a file read, a question asked, a folder entered. A
    /// specimen's only way to reach a state a click or a keyboard puts the room into, and nothing
    /// but a specimen ever passes one.
    private let opening: AtlasRoomOpening

    /// The room the strip in the rail is on. The strip switches the whole window in the app; here
    /// it has nowhere to go, and holds the room it opens in.
    @State private var cockpitRoom = CockpitRoom.atlas
    /// The reader's own channel choice, so a specimen can be DRIVEN — a picker bound to a constant
    /// draws the control and changes nothing when it is used.
    @State private var channels: AtlasChannels
    @State private var hideTests = false
    @State private var showTies = false
    @State private var isCity = false
    /// Which reading of the regions the specimen opens on (#1158), so the harness can render the
    /// map re-tiled by domain — a state no click a screenshot can drive would otherwise reach.
    @State private var grouping: AtlasGrouping

    /// `.unmeasured` is the Project nobody has measured, which is the room's other reading. Only a
    /// `.measured` reading draws `behind` at all (#1162); a specimen handing it in with another
    /// reading asserts nothing.
    package init(
        reading: AtlasReading,
        behind: Int? = nil,
        opening: AtlasRoomOpening = .none,
    ) {
        self.reading = reading
        self.behind = behind
        self.opening = opening
        _channels = State(initialValue: Self.channels(of: reading))
        _grouping = State(initialValue: opening.grouped)
    }

    package var body: some View {
        NavigationSplitView {
            AtlasSidebar(room: room, cockpitRoom: $cockpitRoom)
                .navigationSplitViewColumnWidth(
                    min: ArgoLayout.sidebarMinimumWidth,
                    ideal: ArgoLayout.sidebarIdealWidth,
                    max: ArgoLayout.sidebarMaximumWidth,
                )
        } detail: {
            AtlasRoomView(opening: opening)
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
                filters: AtlasFilterChoice(
                    hideTests: AtlasSwitch(isOn: hideTests) { hideTests = $0 },
                    showTies: AtlasSwitch(isOn: showTies) { showTies = $0 },
                ),
                arrangement: AtlasArrangementChoice(
                    grouping: grouping,
                    setGrouping: { grouping = $0 },
                    isCity: AtlasSwitch(isOn: isCity) { isCity = $0 },
                ),
            ),
        )
    }

    /// The opening channels for whatever was handed in — and none at all for a reading that
    /// carries no Map, which is every vacancy: three empty menus over nothing measured would be
    /// controls naming Measures no repository stands behind.
    private static func channels(of reading: AtlasReading) -> AtlasChannels {
        guard case let .measured(map) = reading else { return AtlasChannels("") }
        return AtlasChannels.opening(for: map)
    }
}
