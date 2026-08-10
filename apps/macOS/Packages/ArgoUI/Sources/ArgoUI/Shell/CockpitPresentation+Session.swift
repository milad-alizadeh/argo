import ArgoEngine

public extension CockpitPresentation {
    /// One Session as the cockpit renders it — the value every surface below the shell takes.
    ///
    /// Its own file rather than a member of `CockpitPresentation`'s: the presentation is a
    /// window's whole input and the Session is the thing the window is mostly about, so the two
    /// grow at different rates and only one of them has to be re-read to answer a question about
    /// a row or a header.
    struct Session: Equatable, Identifiable, Sendable {
        /// What the user can DO with a Session, which is the shell's question. Derived from
        /// provenance — see `Access(provenance:)` — and never asserted beside it.
        ///
        /// Three postures rather than "managed and the rest", because the rest is two facts:
        /// `external` was never Argo's, and `orphaned` was — Argo spawned it and then lost the
        /// PTY with the process that owned it (`CONTEXT.md` L2). Both are read-only, which is
        /// why that is a DERIVED property of a posture here and not a case beside them: a surface
        /// asking "can this be driven" gets one answer, and a surface naming what it is looking
        /// at gets the honest one.
        public enum Access: CaseIterable, Equatable, Sendable {
            case managed
            case external
            case orphaned
        }

        /// Whether the Session's checkout is the Project's own or one it was given.
        ///
        /// Beside `Workspace` rather than inside it, because the nesting cap is two deep and a
        /// third level would be a rule bent to fit a name.
        public enum WorkspaceKind: Equatable, Sendable {
            case main
            case worktree
        }

        /// The git working context the Session is running in (`CONTEXT.md` L3).
        ///
        /// Four facts and no more: `sharedCount` and `headSha` are real Workspace attributes and
        /// belong to surfaces that address a commit, which the header does not. Every count is
        /// OPTIONAL because Argo may not have read git yet, and an unread count is a different
        /// claim from a clean tree.
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

        /// The Work Item this Session serves, as a LINK and never as its content
        /// (`CONTEXT.md` L1): Argo stores the reference, the provider owns the words. The title
        /// is read through and absent whenever the provider has not answered — which, with no
        /// provider connected, is always.
        public struct Issue: Equatable, Sendable {
            public let number: Int
            public let title: String?

            public init(number: Int, title: String? = nil) {
                self.number = number
                self.title = title
            }
        }

        public let id: String
        public let title: String
        public let model: String?
        public let workspaceLocation: String?
        /// Which agent program is running (`CONTEXT.md` L2). Absent where Argo cannot say, which
        /// is every Session read from a record whose CLI it did not recognise.
        public let cli: AgentCLI?
        /// Absent for a Session with no git context at all, rather than an empty Workspace: a
        /// Workspace whose every field is `nil` is a claim that one exists.
        public let workspace: Workspace?
        public let access: Access
        public let status: SessionStatus
        /// The linked Work Item, when there is a provider to have read one from. `nil` covers
        /// both "no provider connected" and "connected, and this Session is unlinked" — the
        /// difference belongs to a provider surface, and neither renders a link here.
        public let issue: Issue?
        /// When this Session was last seen to run, in milliseconds since the epoch. The Hub's own
        /// sort key rather than a second reading of it, so the roster's order and what the roster
        /// says about that order cannot disagree. Absent where neither the records nor the file
        /// behind them could say — which is a gap, never a moment to stand in for one.
        public let lastSeenAtMs: Int?
        /// Everything the Session's transcript said, in order — the feed's whole input.
        ///
        /// The engine's own events rather than a second shape named for the shell: the surface
        /// that draws them is `FeedProjection`, and a presentation that pre-digested the stream
        /// would put the reading decisions somewhere no test can reach them. Empty by default, so
        /// a Session named for a fact about the roster does not have to invent a transcript.
        public let events: [TranscriptEvent]

        public init(
            id: String,
            title: String,
            model: String?,
            workspaceLocation: String?,
            access: Access,
            status: SessionStatus,
            cli: AgentCLI? = nil,
            workspace: Workspace? = nil,
            issue: Issue? = nil,
            lastSeenAtMs: Int? = nil,
            events: [TranscriptEvent] = [],
        ) {
            self.id = id
            self.title = title
            self.model = model
            self.workspaceLocation = workspaceLocation
            self.cli = cli
            self.workspace = workspace
            self.access = access
            self.status = status
            self.issue = issue
            self.lastSeenAtMs = lastSeenAtMs
            self.events = events
        }
    }
}
