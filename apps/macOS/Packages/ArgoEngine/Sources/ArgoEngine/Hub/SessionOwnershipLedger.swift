/// Which Sessions Argo has held the PTY of, and when — the one ownership fact that outlives the
/// process that established it (ADR-0026).
///
/// Durable owned state in ADR-0008's sense: per-machine, never committed, and NOT a roster. It
/// answers a single question no transcript can, and grading has no other way to ask it: a Session
/// Argo spawned and lost reads `orphaned`, one it never touched reads `external`, and after a
/// relaunch nothing in memory can tell those two apart.
public struct SessionOwnershipLedger: Codable, Equatable, Sendable {
    /// One stretch of ownership. `toMs` is `nil` while the PTY lives, which on a file read back
    /// after a relaunch means the Argo that opened it was killed rather than quit.
    public struct Window: Codable, Equatable, Sendable {
        public let fromMs: Int
        public var toMs: Int?
    }

    /// Keyed by the Session id the roster carries, never by a claim: a claim dies with the process
    /// that issued it, and this file is read by the next one.
    public var windows: [String: Window] = [:]

    public init(windows: [String: Window] = [:]) {
        self.windows = windows
    }

    /// Whether Argo has ever held this Session's PTY — the whole of what grading asks.
    public func hasOwned(sessionID: String) -> Bool {
        windows[sessionID] != nil
    }

    /// Argo holds this Session's PTY from now. `fromMs` keeps the FIRST moment it ever did, so a
    /// Session owned, lost and resumed is one Argo has owned since the first of them.
    ///
    /// Answers whether anything moved, so a caller can skip writing a file it did not change.
    mutating func open(sessionID: String, atMs: Int) -> Bool {
        let opened = Window(fromMs: windows[sessionID]?.fromMs ?? atMs, toMs: nil)
        guard windows[sessionID] != opened else { return false }
        windows[sessionID] = opened
        return true
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
