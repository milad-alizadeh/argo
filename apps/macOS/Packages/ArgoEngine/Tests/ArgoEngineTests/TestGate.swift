/// A one-shot signal between two tasks: one side opens it, the other waits until it is open.
///
/// What a test uses instead of polling for a moment it hopes to catch. A transient state — the
/// window inside a `connect`, say — is asserted by parking a port's own adapter inside it, and that
/// needs each side to be able to say "I am here" and "you may go on" without either guessing a
/// duration. Opening twice is harmless; waiting after it opened returns at once.
actor TestGate {
    private var isOpen = false
    private var waiting: [CheckedContinuation<Void, Never>] = []

    func open() {
        isOpen = true
        for continuation in waiting {
            continuation.resume()
        }
        waiting = []
    }

    func opened() async {
        guard !isOpen else { return }
        await withCheckedContinuation { waiting.append($0) }
    }
}
