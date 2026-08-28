import ArgoEngine

/// The Work room's one provider-port write control in each state §4 and §7 give it, so the three
/// are looked at rather than reasoned about.
///
/// `live` is absent for the reason the chip's healthy state is: it is what every other Work room
/// specimen already renders, and a fourth card of an ordinary button would prove nothing.
///
/// What each has to settle is that the vessel's geometry does not move between them — pending and
/// blocked disable in place, and the reason arrives BESIDE the mark rather than under it.
enum WriteControlSpecimen {
    struct State {
        let name: String
        let control: WriteControlState
    }

    private static let account = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "milad-alizadeh",
    )

    static let states: [State] = [
        // A create on the wire: disabled, and saying nothing. A word here would be the layout
        // shift the rule rules out, and a spinner would be the global chrome it also rules out.
        State(name: "writePending", control: .pending),
        // The provider took it and refused it, in its own words. They reach the reader unedited
        // because they are the only part of this that says how to fix it.
        State(
            name: "writeRefused",
            control: .refused(.refused("Issues are disabled for this repository.")),
        ),
        // No usable token, which is the one reading that disables a write control on a fact rather
        // than on a guess — and it names the identity, because a provider has more than one.
        State(name: "writeBlocked", control: .blocked(account)),
    ]
}
