import ArgoEngine
@testable import ArgoUI
import Testing

/// What the room's two Start controls are ANNOUNCED as (#1682). The Tickets room draws both at
/// once and they point at different tickets, so the sentence is the whole of what tells them apart.
@Suite("Start verb spoken")
@MainActor
struct StartVerbSpokenTests {
    /// The fault itself, kept as a test: #1682 was read off the live app with #1667 open in the
    /// pane and #1639 ranked in the hero, and the two labels were byte-identical.
    @Test
    func `the hero and the pane header are announced as different controls`() {
        #expect(StartVerb.spoken(.implement, on: 1639) != StartVerb.spoken(.implement, on: 1667))
    }

    @Test
    func `the label names the ticket it starts and the command it sends`() {
        #expect(
            StartVerb.spoken(.implement, on: 1667)
                == "Start a Session on ticket 1667, on /implement",
        )
    }

    /// A ticket the resolver had no command for still opens a Session — on an empty composer — and
    /// still has to say WHICH ticket, which was the half the absent reading also dropped.
    @Test
    func `a ticket that asks for no command is still named`() {
        #expect(
            StartVerb.spoken(nil, on: 1667)
                == "Start a Session on ticket 1667, with an empty composer",
        )
    }

    /// Degrade-down: a control that does not know its number says less rather than saying a wrong
    /// one. That is `Verbs.inert`, which is the room with no ticket open.
    @Test(arguments: [WorkCommand.implement, nil])
    func `a control with no ticket behind it falls back to the unnamed reading`(
        command: WorkCommand?,
    ) {
        #expect(StartVerb.spoken(command, on: nil).hasPrefix("Start a Session on this ticket,"))
    }
}
