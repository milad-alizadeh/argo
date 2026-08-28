import ArgoEngine

/// The Tickets room's one provider-port write control in each state §4 and §7 give it. What they
/// have
/// to settle is that the vessel's geometry does not move between them, and that the reason arrives
/// beside the mark rather than under it.
///
/// `live` is absent: every other Tickets room specimen already renders it.
enum WriteControlSpecimen {
    struct State {
        let name: String
        let control: WriteControlState
    }

    static let states: [State] = [
        // A create on the wire: disabled, and saying nothing.
        State(name: "writePending", control: .pending),
        // The provider's own words, unedited.
        State(
            name: "writeRefused",
            control: .refused(.refused("Issues are disabled for this repository.")),
        ),
        // The one reading that disables a write control on a fact rather than a guess. It names the
        // identity, because a provider has more than one on a machine.
        State(name: "writeBlocked", control: .blocked(ConnectFixture.personal)),
    ]
}
