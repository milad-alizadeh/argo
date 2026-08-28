import ArgoEngine

/// Starting a Session ON a ticket (#899) — the act both of the room's Start controls raise.
///
/// It does three things the spawn alone does not: it resolves the command the ticket asks for, it
/// seeds the fresh Session's first turn with it, and it takes the window to the Sessions room so
/// the work it just began is what the reader is looking at.
///
/// **The room switch reverses #872's decision, and the reversal is the point.** Staying put was
/// right for a Start whose only answer was the backlog row going claimed; a Start that begins real
/// work has its answer in the other room, and staying put hides it.
@MainActor
struct TicketStart {
    /// The active Project's listing, which is where a ticket's labels are read from.
    let tickets: [Ticket]
    /// The screens this checkout has settled a design for (`DesignedScreens`), which is the half of
    /// the mapping no label can carry.
    let designs: Set<String>
    /// The spawn itself, answering with the fresh Session's id and `nil` where none started.
    let spawn: (Int, SessionMode, String?) async -> String?

    /// Which command Start will send, so a control can SAY it before it is pressed: a press that
    /// silently dispatches one of five different jobs is a press nobody can aim.
    func command(on ticket: Int) -> WorkCommand? {
        tickets.first { $0.number == ticket }
            .flatMap { WorkCommand.resolving($0, designs: designs) }
    }

    /// `Code` is the rung work needs and the only one this room offers (`cockpit-work-room.md`,
    /// "`Start` starts"). It stays changeable over the live Session, in the composer's
    /// `ModePicker`,
    /// which is the one control that reads the rung back.
    ///
    /// A refusal moves nothing: it is reported by the app, and the reader is left looking at the
    /// list they were triaging rather than at a room with nothing in it.
    func run(on ticket: Int, in navigation: CockpitNavigationModel) async {
        guard let fresh = await spawn(ticket, .code, command(on: ticket)?.opening(on: ticket))
        else { return }
        navigation.session = fresh
        navigation.room = .sessions
    }
}
