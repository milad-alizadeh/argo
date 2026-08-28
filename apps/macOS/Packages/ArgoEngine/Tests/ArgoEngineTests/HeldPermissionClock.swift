@testable import ArgoEngine
import Foundation

/// The gate's own clock, fired by hand rather than by seconds (#826).
///
/// One latch over every table the patience reaches — `PermissionChannel` hands the same value to
/// its own and to its `AskGate` — and `release` is permanent: anything raised after it expires at
/// once.
///
/// It holds by polling because the poll's sleep is cancellable, which `elapse` requires.
@MainActor
final class HeldPermissionClock {
    private var released = false

    /// A patience whose `seconds` nothing reads — `elapse` is what decides, and it decides below.
    var patience: PermissionPatience {
        PermissionPatience(seconds: 0, elapse: { [weak self] in await self?.hold() })
    }

    func release() {
        released = true
    }

    private func hold() async {
        while !released, !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }
}
