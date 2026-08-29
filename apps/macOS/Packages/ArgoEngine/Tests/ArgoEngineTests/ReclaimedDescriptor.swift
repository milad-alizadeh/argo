import Darwin

/// One descriptor number, taken back off the kernel.
///
/// The kernel issues the LOWEST free number, so a number just released is not necessarily the next
/// one out — everything free below it comes first. This opens sockets until the number comes up and
/// holds the ones below it, which is what lets a suite stage the reuse #936 turned on deliberately,
/// with no load and no waiting.
@MainActor
struct ReclaimedDescriptor {
    let number: Int32
    private let below: [Int32]

    /// `nil` where the number never came up: a suite running beside this one took it first, or more
    /// numbers were free below it than the bound. Neither is the defect under test, so a caller
    /// reads `nil` as "could not stage it" rather than as a failure — retried first, because a
    /// theft is a moment rather than a state.
    static func taking(_ number: Int32, attempts: Int = 3) -> ReclaimedDescriptor? {
        for _ in 0 ..< attempts {
            if let taken = attempt(number) {
                return taken
            }
        }
        return nil
    }

    /// Free the number itself and keep the rest held, so the very next socket opened IS this
    /// number. What the caller opens then owns it, and `dropHeld` is all that is left to give back.
    func releaseNumber() {
        closeIfOpen(number)
    }

    /// Give back everything below the number, leaving the number to whoever holds it now.
    func dropHeld() {
        for one in below {
            closeIfOpen(one)
        }
    }

    /// Give everything back, the number included — for a caller that never released it.
    func dropAll() {
        closeIfOpen(number)
        dropHeld()
    }

    private static func attempt(_ number: Int32) -> ReclaimedDescriptor? {
        var opened: [Int32] = []
        while opened.count < 256, !opened.contains(number) {
            let next = socket(AF_UNIX, SOCK_STREAM, 0)
            guard next >= 0 else { break }
            opened.append(next)
        }
        guard opened.contains(number) else {
            for one in opened {
                Darwin.close(one)
            }
            return nil
        }
        return ReclaimedDescriptor(number: number, below: opened.filter { $0 != number })
    }

    /// Checked before closing, because in the failing case the number has already been closed under
    /// whoever holds it — and closing it again would be the very defect this exists to catch.
    private func closeIfOpen(_ one: Int32) {
        guard fcntl(one, F_GETFD) != -1 else { return }
        Darwin.close(one)
    }
}
