import ArgoEngine

public extension CockpitActions {
    /// Everything the shell raises against a Session (`CONTEXT.md` L2) that the app layer performs
    /// — starting one, continuing one, and Argo's own annotations on it. What a Session is ASKED
    /// to do while it runs is not here: that is `CockpitActions.drive`, the engine's port.
    ///
    /// Each closure defaults to doing nothing, on the same terms as `Projects`.
    struct Sessions {
        /// Start an agent in the active Project's folder, with Argo owning its PTY. Answers with
        /// the fresh Session's id — the claim the roster publishes its row under — and `nil` where
        /// no Session started; the app performs the spawn, the shell decides what to point at.
        public var spawn: () async -> String? = { nil }
        /// Continue a Session Argo can no longer steer, in a fresh process on the same chain (#10).
        /// Raised by selection, because the click is the intent.
        ///
        /// It answers nothing: the composer appearing is the answer, and a refusal is said by the
        /// app.
        public var resume: (String) async -> Void = { _ in }
        /// Start an agent in the folder ANOTHER Session was running in — the act available on a
        /// Session that cannot be driven and cannot be continued either (#546). Keyed by that
        /// Session's id and not by a path, because the folder is the engine's to read: the shell
        /// knows which Session the reader is looking at and nothing about where it lives.
        ///
        /// Answers the way `spawn` does, and for the same reason.
        public var spawnBeside: (String) async -> String? = { _ in nil }
        /// Clear a Session off the roster, or put one back. The ONLY thing that ever archives one:
        /// nothing derived from a merge, a branch or a transcript reaches this, which is what makes
        /// archiving a decision rather than a status transition (#502, story 14).
        public var setArchived: (String, Bool) -> Void = { _, _ in }
        /// Give a Session a name of the user's own, or — with `nil` — drop it and let the derived
        /// title come back (#502, stories 18 and 20).
        public var setName: (String, String?) -> Void = { _, _ in }
        /// Attach a Session to a Ticket by hand, or — with `nil` — drop the attachment and let
        /// whatever its branch names come back (#1092).
        ///
        /// Beside `setName` and not on the Tickets port: nothing is being asked of a provider —
        /// this is Argo remembering a decision of the reader's, which is the one kind of thing
        /// `CONTEXT.md` lets it store.
        public var setTicketLink: (String, Int?) -> Void = { _, _ in }
        /// Say the Turn the CLI never heard has been put back in the composer (#682), so the Hub
        /// stops reporting it. Not on the drive port: nothing is being asked of the Session — this
        /// is Argo taking back its own news, and the port is what Argo does TO an agent.
        public var clearLostTurn: (String) -> Void = { _ in }
        /// Hand a full Session's work to a fresh one: run `/handoff` in it, wait for the brief, and
        /// start a Session seeded with it in the same folder and against the same issue (#513).
        ///
        /// The only action here answered in minutes: the control that raises it holds itself for as
        /// long as it runs. The issue travels WITH the id because the engine carries no Ticket, so
        /// the view is where the link is known.
        ///
        /// Answers with the fresh Session's id, `nil` where no handoff happened — the app performs
        /// and the shell decides what to point at (`CockpitNavigationModel.session` is not public).
        public var handOff: (String, Int?) async -> String? = { _, _ in nil }

        public init() {}
    }
}
