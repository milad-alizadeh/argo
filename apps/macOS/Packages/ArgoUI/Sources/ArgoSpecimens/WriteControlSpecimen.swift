import ArgoEngine
import ArgoUI

/// The Tickets room's one provider-port write control in each state §4 and §7 give it. What they
/// have to settle is that the vessel's geometry does not move between them, and that the reason
/// arrives beside the mark rather than under it.
///
/// `live` is absent: every other Tickets room specimen already renders it.
enum WriteControlSpecimen {
    struct State {
        let name: String
        let control: WriteControlState
    }

    /// GitHub's own words about a create it would not take: the line that names the failure, and
    /// under it the only text that says what to change. The output §5 was written for.
    static let validationRefusal = """
    Validation Failed: title is too long (maximum is 256 characters)
    For 'links/0/schema', nil is not an object.
    See https://docs.github.com/rest/issues/issues#create-an-issue
    """

    static let states: [State] = [
        // A create on the wire: disabled, and saying nothing.
        State(name: "writePending", control: .pending),
        // The provider's own words, unedited, on a refusal that fits one line and so opens onto
        // itself.
        State(
            name: "writeRefused",
            control: .refused(.refused("Issues are disabled for this repository.")),
        ),
        // The state the gesture exists for: a line at the control, and three more the reader would
        // never see without it (#850).
        State(
            name: "writeRefusedAtLength",
            control: .refused(.refused(validationRefusal)),
        ),
        // The one reading that disables a write control on a fact rather than a guess. It names the
        // identity, because a provider has more than one on a machine.
        State(name: "writeBlocked", control: .blocked(ConnectFixture.personal)),
    ]
}
