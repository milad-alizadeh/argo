import ArgoEngine

/// A Start control's whole input: what the press does, and what it will send.
///
/// The two travel together everywhere — the room hands them to the hero, the hero's card draws one
/// and calls the other — so they are one value rather than a pair of closures repeated at each
/// stop. Both address the ticket BY NUMBER, the way the hero's open verb does.
///
/// The reading is separate from the act because the card SAYS the command before it is pressed; a
/// single closure could only answer after.
@MainActor
package struct StartIntent {
    var run: (Int) -> Void = { _ in }
    var command: (Int) -> WorkCommand? = { _ in nil }

    /// A control that draws and performs nothing, for a `#Preview` and a specimen.
    static let inert = StartIntent()

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        run: @escaping (Int) -> Void = { _ in },
        command: @escaping (Int) -> WorkCommand? = { _ in nil },
    ) {
        self.run = run
        self.command = command
    }
}
