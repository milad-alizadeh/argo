import SwiftUI

/// The Connect flow's states: the way in, the panel in each shape it takes, and the chips the
/// window carries when a connection has gone bad.
///
/// Its own file rather than more arms on the catalog's switch, which had outgrown one — a list of
/// states reads as a list only while it fits on a screen. The split is by subject and not by size:
/// these are the states of getting and keeping a connection, and the switch above is everything a
/// Session is rendered as.
extension SpecimenScreen {
    @ViewBuilder var connectFlow: some View {
        switch specimen {
        case .welcome:
            // The first thing a new user sees, and the one screen here that asks for nothing. What
            // it has to settle is that three promises read as promises rather than as a feature
            // grid, and that nothing on it needs a tier explained first.
            centred { WelcomeScreen(start: {}) }
        case .connectionStale, .connectionsStale, .connectionNeedsReconnect:
            // One chip per level a connection fails at: a provider waited out, two rolled up to a
            // count, and a grant that needs obtaining again — named, and with the one act on it.
            centred { connectionChips }
        // One panel per state it can be in, because they are structural rather than a value
        // changing: nothing set, a folder alone, half connected, both ports on two identities, a
        // grant mid-flight, a refusal, a Binding that came undone, and the same panel re-entered as
        // Settings. The claim every one of them carries is that the panel is still usable — a
        // partly connected Project is a Project, and a refusal is a note on a row rather than a
        // screen to get out of.
        //
        // Written as the fallback rather than as a named list: it is the state every OTHER case in
        // the flow is a departure from, and a second list of the same names would be a thing to
        // keep in step with the switch above.
        default:
            centred { ConnectPanel(reading: connectReading, actions: .inert) }
        }
    }
}
