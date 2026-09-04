import ArgoEngine

/// Starting a Session ON a ticket (#899) — the act both of the room's Start controls raise.
///
/// It does three things the spawn alone does not: it resolves the command the ticket asks for, it
/// seeds the fresh Session's first turn with it, and it takes the window to the Sessions room so
/// the work it just began is what the reader is looking at.
///
/// The room switch reverses #872's decision to stay put, which held for a Start whose only answer
/// was the backlog row going claimed.
@MainActor
struct TicketStart {
    /// The active Project's listing, which is where a ticket's labels are read from.
    let tickets: [Ticket]
    /// The screens this checkout has settled a design for (`DesignedScreens`), which is the half of
    /// the mapping no label can carry.
    ///
    /// A closure and not the set: reading it walks a directory, and this value is assembled on
    /// every pass of the room's body while a Start is drawn on only some of them.
    let designs: () -> Set<String>
    /// The spawn itself, answering with the fresh Session's id and `nil` where none started.
    let spawn: (Int, SessionMode, String?) async -> String?

    /// Which command Start will send, so a control can say it before it is pressed (`StartVerb`).
    func command(on ticket: Int) -> WorkCommand? {
        tickets.first { $0.number == ticket }
            .flatMap { WorkCommand.resolving($0, designs: designs()) }
    }

    /// The rung is the mapping's and this room offers no other (`cockpit-work-room.md`, "`Start`
    /// starts", amended #941). It stays changeable over the live Session, in the composer's
    /// `ModePicker` — the one control that reads the rung back.
    ///
    /// A refusal moves nothing: it is reported by the app, and the reader is left looking at the
    /// list they were triaging rather than at a room with nothing in it.
    func run(on ticket: Int, in navigation: CockpitNavigationModel) async {
        await run(on: ticket, in: navigation, sending: command(on: ticket))
    }

    /// The same act on a command the reader PICKED (#1242) — including `nil`, which is the fresh
    /// Session that carries the ticket and opens on an empty composer.
    ///
    /// The picked command is passed rather than resolved again: the menu drew the resolved one to
    /// be departed from, and re-resolving here would put it back.
    func run(
        on ticket: Int,
        in navigation: CockpitNavigationModel,
        sending command: WorkCommand?,
    ) async {
        guard let fresh = await spawn(
            ticket,
            WorkCommand.startingMode,
            command?.opening(on: ticket),
        )
        else { return }
        navigation.session = fresh
        navigation.room = .sessions
    }
}
