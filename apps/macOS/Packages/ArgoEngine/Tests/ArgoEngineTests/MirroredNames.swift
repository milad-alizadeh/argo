@testable import ArgoEngine

/// The other end of `NameMirror` for a suite: what was typed at which Session, and whether that
/// prompt would take it (#1494, #1623).
///
/// Shared by both of the port's callers' suites rather than one apiece — a second copy would let
/// the two drift on what a refusal means, which is the one thing both of them are about.
actor MirroredNames {
    struct Call: Equatable {
        let title: String
        let sessionID: String
    }

    /// What the next call answers. `false` stands for every prompt that could not take the line —
    /// a Turn in flight, a pending Permission, a `codex` Session.
    private var takes = true
    private var recorded: [Call] = []

    init(takes: Bool = true) {
        self.takes = takes
    }

    /// The port, wired to this recorder.
    nonisolated var mirror: NameMirror {
        NameMirror { title, sessionID in await self.record(title, to: sessionID) }
    }

    func calls() -> [Call] {
        recorded
    }

    func nowTakes(_ takes: Bool) {
        self.takes = takes
    }

    func record(_ title: String, to sessionID: String) -> Bool {
        recorded.append(Call(title: title, sessionID: sessionID))
        return takes
    }
}
