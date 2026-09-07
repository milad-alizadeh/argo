import ArgoEngine

public extension CockpitPresentation {
    /// One Session as the cockpit renders it — the value every surface below the shell takes.
    struct Session: Equatable, Identifiable, Sendable {
        /// What the user can DO with a Session. Derived from provenance — see
        /// `Access(provenance:)` — and never asserted beside it.
        ///
        /// `external` was never Argo's; `orphaned` was — Argo spawned it and then lost the PTY
        /// with the process that owned it (`CONTEXT.md` L2). Both are read-only.
        public enum Access: CaseIterable, Equatable, Sendable {
            case managed
            case external
            case orphaned
        }

        /// Whether the Session's checkout is the Project's own or one it was given — the
        /// engine's own enum, aliased rather than restated.
        public typealias WorkspaceKind = WorkspaceProjection.Kind

        /// The git working context the Session is running in (`CONTEXT.md` L3).
        ///
        /// Every count is OPTIONAL because Argo may not have read git yet, and an unread count is
        /// a different claim from a clean tree.
        public struct Workspace: Equatable, Sendable {
            public let kind: WorkspaceKind?
            /// The join key (`CONTEXT.md` L3) — and the header's own subject line. Absent for a
            /// Session that has not branched, never a placeholder standing in for one.
            public let branch: String?
            public let dirty: Int?
            public let unpushed: Int?

            public init(
                kind: WorkspaceKind? = nil,
                branch: String? = nil,
                dirty: Int? = nil,
                unpushed: Int? = nil,
            ) {
                self.kind = kind
                self.branch = branch
                self.dirty = dirty
                self.unpushed = unpushed
            }
        }

        /// The Ticket this Session serves, as a LINK and never as its content
        /// (`CONTEXT.md` L1): Argo stores the reference, the provider owns the words. The title
        /// is read through and absent whenever the provider has not answered — which, with no
        /// provider connected, is always.
        public struct Issue: Equatable, Sendable {
            public let number: Int
            public let title: String?
            /// Which reading produced this link (`CONTEXT.md` Honesty tier). DIRECT is the number
            /// Argo was TOLD at the spawn; DERIVED is the one read off a branch by convention. The
            /// default is the lower of the two, so a link built without saying which never claims
            /// to be the firmer one (degrade-down).
            public let tier: Tier

            public init(number: Int, title: String? = nil, tier: Tier = .derived) {
                self.number = number
                self.title = title
                self.tier = tier
            }
        }

        public let id: String
        /// The ids this row's OTHER chain links were published under, oldest first, and empty for
        /// a chain of one (#1481). Beside `id` because it is the same kind of fact: a window
        /// pointing at one of these is pointing at THIS Session, under an id it stood on before
        /// the sweep that found its origin absorbed it (`HubSession.absorbedIDs`).
        ///
        /// Set after the init rather than through it, on `Transcript.delegationHold`'s reasoning:
        /// the parameter list below is already past the four-parameter cap
        /// (`apps/macOS/.swiftlint.yml`), and one more would authorise the next one. A fixture that
        /// wants this states it the same way.
        public var absorbedIDs: [String] = []
        public let title: String
        public let access: Access
        public let status: SessionStatus
        /// The resume chain (`CONTEXT.md` L2) — what runs this link, when it ran, what it handed
        /// its work to, and whether Argo's own channel to it is up.
        public let chain: Chain
        /// Where the Session is working and what it is working ON — the checkout, the folder it
        /// sits in, the Ticket reading its branch feeds, and that branch's own pull request.
        public let work: Work
        /// The Session's Usage (`CONTEXT.md` L3), every figure in tokens.
        public let spend: Spend
        /// Autonomy (`CONTEXT.md` L4): the standing stance, and everything the Session is blocked
        /// on or has stopped being blocked on.
        public let autonomy: Autonomy
        /// Argo's own decisions about this chain id, read off `SessionAnnotations` rather than off
        /// anything observed.
        public let annotations: Annotations
        /// Everything the transcript said, and the stamp the cockpit compares it by — see
        /// `Transcript`. Stored whole rather than unpacked into three fields, so this Session's
        /// synthesised equality answers about the stream in an integer comparison: unpacked, one
        /// body pass deep-compared every Session's whole decoded stream (ADR-0028 Rule 1).
        public let transcript: Transcript

        /// Grouped by the reading each fact comes from (#755), and every group STORED rather than
        /// unpacked onto a second set of fields (#1503): each fact is declared by the value that
        /// holds it, and by nothing else. The four ungrouped parameters are the four no default
        /// can supply; every value below defaults, so a fixture still names only the fact it is
        /// about.
        ///
        /// What a surface reads did not change. The flat facts are DERIVED off these six values in
        /// `CockpitPresentation+SessionFacts.swift`, on `Transcript`'s own precedent, in place of
        /// the 35 assignments this init used to make. Each of those derivations keeps the engine's
        /// own name for its fact, and carries a `renamed:` line where it cannot — convention now,
        /// held in review, since the boundaries gate that used to check it was deleted (#1532).
        public init(
            id: String,
            title: String,
            access: Access,
            status: SessionStatus,
            chain: Chain = .init(),
            work: Work = .init(),
            spend: Spend = .init(),
            autonomy: Autonomy = .init(),
            annotations: Annotations = .init(),
            transcript: Transcript = .init(),
        ) {
            self.id = id
            self.title = title
            self.access = access
            self.status = status
            self.chain = chain
            self.work = work
            self.spend = spend
            self.autonomy = autonomy
            self.annotations = annotations
            self.transcript = transcript
        }
    }
}

extension CockpitPresentation.Session.Access {
    /// Access is what provenance IS, rather than a policy applied to it: Argo owns no PTY for a
    /// Session it did not spawn, and an orphaned one lost the PTY it had. One case each, so the
    /// shell can say which of the two it is looking at.
    init(provenance: SessionProvenance) {
        self = switch provenance {
        case .managed: .managed
        case .external: .external
        case .orphaned: .orphaned
        }
    }
}
