import Darwin
import Foundation

/// Which Sessions Argo has held the PTY of, and when — the one ownership fact that outlives the
/// process that established it (ADR-0026).
///
/// Durable owned state in ADR-0008's sense: per-machine, never committed, and NOT a roster. It
/// answers two questions no transcript can: has any Argo held this Session, which separates
/// `orphaned` from `external` after a relaunch, and is one holding it NOW, which stops a second
/// cockpit window resuming a chain the first is already writing to.
struct SessionOwnershipLedger: Codable, Equatable, Sendable {
    /// Who holds a window. The process AND the registry inside it, because one Argo process runs
    /// many cockpit windows with a registry each — on the pid alone two windows are one owner. The
    /// pid is what says whether that owner is still there at all.
    struct Owner: Codable, Equatable, Sendable {
        let pid: Int32
        let registry: String

        /// Whether this owner is still around to be holding anything.
        ///
        /// `kill(pid, 0)` probes for a process without signalling it, and `EPERM` means it is there
        /// and this user may not signal it — still there, which is the whole question.
        var isRunning: Bool {
            guard kill(pid, 0) != 0 else { return true }
            return errno == EPERM
        }

        /// A fresh identity for one registry in this process. Fresh per call, because that is what
        /// "one registry" means — two of them in one Argo must not read as each other.
        static var thisRegistry: Owner {
            Owner(pid: getpid(), registry: UUID().uuidString)
        }
    }

    /// One stretch of ownership. `toMs` is `nil` while the PTY lives, so an open window means one
    /// of two things: its owner is still steering, or that Argo was killed before it could close
    /// it.
    struct Window: Codable, Equatable, Sendable {
        let fromMs: Int
        var toMs: Int?
        /// Absent in a file written before this field existed, which reads as nobody holding it —
        /// the quieter answer, and the one a relaunch wants.
        var owner: Owner?
        /// The Ticket Argo was TOLD this Session was started on (#872), kept where the next launch
        /// can still read it (#894). DIRECT, and the only reading that survives the process that
        /// established it — without it a relaunch has the branch guess alone. Absent for every
        /// Session nobody named a number for, which is every external one.
        var ticket: Int?
        /// The rung Argo STARTED this Session on, where the Start named one of its own — a Session
        /// started from a Ticket (#941). Spelled by `SessionModeName`, and absent for a Session
        /// that opened on the rung last picked, which is nobody's choice for this Session in
        /// particular. Read by a resume (#966), which honours it where the record states no stance.
        var startingRung: String?
    }

    /// Keyed by the Session id the roster carries, never by a claim: a claim dies with the process
    /// that issued it, and this file is read by the next one.
    var windows: [String: Window] = [:]

    /// Whether Argo has ever held this Session's PTY — the whole of what grading asks.
    func hasOwned(sessionID: String) -> Bool {
        window(for: sessionID) != nil
    }

    /// This Session's window, under the path it has now or under the one the CLI moved it FROM.
    ///
    /// The key here is a path, and a path is the one thing about a Session that changes: the CLI
    /// moves the transcript into a worktree's own record directory, and a window written before
    /// that move is keyed to a file that no longer exists (#770). Matched on the uuid the two
    /// paths share, which is the file's name — the same key the chain graph joins the two halves
    /// on, and the same one a claim follows a move by (`liveClaimWhoseTranscriptMoved`).
    ///
    /// Not a guess about a neighbour: the uuid is what Argo NAMED when it spawned the agent
    /// (#742), so a window under it is this Session's own however its path has moved. Reading it
    /// as somebody else's agent is the false `external` of #1406, and it is the one reading Argo
    /// must never render.
    private func window(for sessionID: String) -> Window? {
        if let held = windows[sessionID] {
            return held
        }
        let uuid = Self.uuid(of: sessionID)
        return windows.first { Self.uuid(of: $0.key) == uuid }?.value
    }

    /// A transcript path's uuid, which is its file name without the extension.
    private static func uuid(of path: String) -> Substring {
        let name = path.split(separator: "/").last ?? Substring(path)
        guard let dot = name.lastIndex(of: ".") else { return name }
        return name[name.startIndex ..< dot]
    }

    /// Whether a registry other than `mine` is holding this Session's PTY right now. An open window
    /// whose owner has died is the ordinary orphan and answers `false`.
    func isHeld(sessionID: String, byAnyoneBut mine: Owner) -> Bool {
        guard let window = windows[sessionID], window.toMs == nil,
              let owner = window.owner, owner != mine
        else { return false }
        // Same process, different registry: another window of this Argo, which is running by the
        // fact that this code is.
        return owner.pid == mine.pid || owner.isRunning
    }

    /// Argo holds this Session's PTY from now. `fromMs` keeps the FIRST moment it ever did, so a
    /// Session owned, lost and resumed is one Argo has owned since the first of them.
    ///
    /// Answers whether anything moved, so a caller can skip writing a file it did not change.
    mutating func open(sessionID: String, atMs: Int, owner: Owner) -> Bool {
        let held = windows[sessionID]
        let opened = Window(
            fromMs: held?.fromMs ?? atMs, toMs: nil, owner: owner, ticket: held?.ticket,
            startingRung: held?.startingRung,
        )
        guard windows[sessionID] != opened else { return false }
        windows[sessionID] = opened
        return true
    }

    /// One fact a spawn named about this Session, written onto its window rather than beside it, so
    /// every fact about one Session is dropped together or not at all.
    ///
    /// Answers whether anything moved, on the same ground `open` does. By key path because the
    /// facts differ only in which slot they fill, and two of these written out would be one shape
    /// said twice.
    mutating func note<Value: Equatable>(
        _ value: Value,
        at fact: WritableKeyPath<Window, Value?>,
        sessionID: String,
    )
        -> Bool {
        guard var window = windows[sessionID], window[keyPath: fact] != value else { return false }
        window[keyPath: fact] = value
        windows[sessionID] = window
        return true
    }

    /// What a previous Argo was told this Session was started on, and `nil` where none was.
    func ticket(sessionID: String) -> Int? {
        window(for: sessionID)?.ticket
    }

    /// The rung a Start named for this Session, spelled the way this file spells one — so the
    /// mapping and the reading below are the same type's business (#966).
    mutating func note(startingRung rung: SessionMode, sessionID: String) -> Bool {
        note(SessionModeName.of(rung), at: \.startingRung, sessionID: sessionID)
    }

    /// The rung a previous Argo started this Session on, and `nil` where the Start named none.
    func startingRung(sessionID: String) -> SessionMode? {
        window(for: sessionID)?.startingRung.flatMap(SessionModeName.rung(named:))
    }

    /// And no longer does. An id no window was opened for is left alone: the PTY that ran under it
    /// was never Argo's, and closing a window here would claim it was.
    mutating func close(sessionID: String, atMs: Int) -> Bool {
        guard var window = windows[sessionID], window.toMs == nil else { return false }
        window.toMs = atMs
        windows[sessionID] = window
        return true
    }
}
