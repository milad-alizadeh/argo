@testable import ArgoEngine

/// A startup wait that ends when the TEST says so, rather than on a clock of zero seconds.
///
/// `StartupPatience.immediate` sleeps for zero seconds, and a spawn arms its clock the moment it is
/// made — so a test that arranges the world AFTER spawning is racing that clock, and on a machine
/// that schedules the task first the arrangement lands too late. That is a flake rather than a
/// finding: `a process gone at the limit is written as the exit nobody reported` failed about two
/// runs in five here and every run on CI, because the limit fired while the child was still up and
/// took the quiet branch.
///
/// So the wait is held open instead. The clock is still the real one and the seam is still
/// `StartupPatience.elapse` — what changes is that the test decides when it runs out, which is the
/// only thing these suites ever meant by "immediate".
actor StartupGate {
    private var isOpen = false
    private var waiting: [CheckedContinuation<Void, Never>] = []

    /// The wait itself, for `StartupPatience.elapse` to spend.
    func elapse() async {
        guard !isOpen else { return }
        await withCheckedContinuation { waiting.append($0) }
    }

    /// Let the limit run out, now that the world is arranged. Idempotent, and safe with nobody
    /// waiting: a test that opens a gate no spawn ever armed is arranging nothing, not failing.
    func open() {
        isOpen = true
        for continuation in waiting {
            continuation.resume()
        }
        waiting = []
    }
}

extension StartupPatience {
    /// A wait one `StartupGate` ends. Zero seconds, because the number a surface would publish is
    /// still "no wait at all" — it is only WHEN that no-wait is spent that the gate moves.
    static func held(by gate: StartupGate) -> StartupPatience {
        StartupPatience(seconds: 0, elapse: { await gate.elapse() })
    }
}
