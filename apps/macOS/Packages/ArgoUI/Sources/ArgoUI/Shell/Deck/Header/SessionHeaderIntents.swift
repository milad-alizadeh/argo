/// What the deck's header offers to DO with the Session it is naming — the acts that reach it
/// from the CHROME rather than from the composer, which is what makes them one value and not two
/// parameters threaded side by side down five views (rules/house.md, edge 6).
///
/// Both are inert by default, so a specimen draws the controls with nothing behind them.
package struct SessionHeaderIntents {
    /// Hand this Session's work to a fresh one. `async` because `/handoff` is a whole turn of an
    /// agent's work, so the control holds itself for as long as it runs.
    package var handOff: () async -> Void = {}
    /// Send `/ship` to this Session (#1335). Sync, unlike `handOff`: it types one Turn and
    /// asserts nothing about how long shipping takes — the Session reports its own status.
    package var createPullRequest: () -> Void = {}

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        handOff: @escaping () async -> Void = {},
        createPullRequest: @escaping () -> Void = {},
    ) {
        self.handOff = handOff
        self.createPullRequest = createPullRequest
    }
}
