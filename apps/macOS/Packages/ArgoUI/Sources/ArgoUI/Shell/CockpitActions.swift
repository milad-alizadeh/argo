import ArgoEngine

/// The intents the shell raises. Every one of them is performed by the app layer — a folder
/// picker, a Finder call, a registry write — so the View decides WHAT is being asked for and
/// nothing about how it happens.
///
/// Grouped by the subject each intent acts on (#999), the way `CockpitPresentation.Session` groups
/// by the reading each fact comes from: a Project, a Session, a reading the cockpit can ask to be
/// taken again, the composer's pickers and the Tickets room.
///
/// Every group stays outside the initialiser, on the terms `tickets` has been on since #872: each
/// act in it stands in for the app layer and defaults to doing nothing, so a surface wires what it
/// offers and `inert` is the value that offers none of it. `drive` is the one port here, and the
/// one thing no default can supply.
public struct CockpitActions {
    /// What the shell asks of a Project — the registry of them, and the one it is pointed at.
    public var projects = Projects()
    /// What the shell asks of a Session, from the spawn to the archive.
    public var sessions = Sessions()
    /// The two readings the cockpit can ask to be taken again.
    public var retry = Retry()
    /// What the composer's own pickers list, walked off disk by the app layer.
    public var composer = Composer()
    /// What the Tickets room's row performs through a provider (#872).
    public var tickets = Tickets()

    /// The two acts the Tickets room's row raises that reach outside the shell.
    ///
    /// Both `async` and both answered: a create answers with the refusal that stopped it, so the
    /// composer can put the provider's own words beside the button (§4); a spawn answers with the
    /// fresh Session's id, on the same terms as `Sessions.spawn`.
    public struct Tickets {
        /// File a ticket through `TicketWriter`. Answers `nil` where it landed, and the refusal
        /// otherwise — nothing retries, so the reply IS the outcome.
        public var createTicket: (TicketDraft) async -> TicketWriteError? = { _ in nil }
        /// Start a Session ON one ticket, on the rung the row names, opening on the prompt the
        /// ticket asks for (#899). The seed carries the number, which is what makes the Session
        /// claimable back (`TicketsReading.claimed`), and the opening is `nil` where the ticket
        /// matches no rule — an empty composer, which is the honest answer.
        public var startSession: (Int, SessionMode, String?) async -> String? = { _, _, _ in nil }
        /// The screens the Project has settled a design for, read off `docs/designs/` on every call
        /// (`DesignedScreens`). Performed by the app layer for `Composer.skills`' reason: it walks
        /// a directory, and no view in `ArgoUI` may.
        public var designedScreens: () -> Set<String> = { [] }
        /// Make one of the reads a room raises — a link followed by number (#895), or a page of
        /// the closed listing (#1075). ONE slot for all of them, because none is on a cadence and
        /// each answers nothing: what lands in the ledger is the answer.
        public var read: (TicketRead) async -> Void = { _ in }
    }

    /// Everything the shell asks a Session to DO, through the engine's port (ADR-0024, #633).
    /// Unlike the intents above, none of it is the app layer's to perform — it reaches no panel
    /// and no Finder, so there is nothing here for a closure to stand in front of.
    public let drive: any SessionDriver

    /// For previews and specimens, where nothing is wired and nothing should be. `@MainActor`
    /// because every action here is called from a view. Every group is left at its default, which
    /// is what makes this the value that performs nothing.
    @MainActor public static let inert = CockpitActions(drive: inertDriver)

    /// What `inert` drives. It declares NO attachments, which is what keeps the `+` off every
    /// preview and specimen that renders a composer.
    @MainActor private static var inertDriver: InMemorySessionDriver {
        let driver = InMemorySessionDriver()
        driver.declaredSurface = DriveSurface(
            takesAttachments: false, runsCommands: true, resolvesMentions: true,
        )
        return driver
    }

    /// The port, which is the only thing here that has no default to fall back on.
    public init(drive: any SessionDriver) {
        self.drive = drive
    }
}
