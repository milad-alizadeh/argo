import ArgoEngine
@testable import ArgoUI
import Testing

/// What one provider-port write control renders, folded from what the port admits and where the
/// last attempt got to (`cockpit-failure-states-spec.md` §4, §7).
@Suite("Write control state")
struct WriteControlStateTests {
    private let account = ConnectFixture.personal

    @Test
    func `an admitted port with nothing in flight is pressable`() {
        let state = WriteControlState.over(.admitted, attempt: .idle)

        #expect(state == .live)
        #expect(state.isEnabled)
        #expect(state.reason == nil)
    }

    @Test
    func `a write in flight disables the control and says nothing`() {
        let state = WriteControlState.over(.admitted, attempt: .pending)

        #expect(state == .pending)
        #expect(!state.isEnabled)
        #expect(state.reason == nil)
    }

    /// §4: failure returns the control to its prior state. Pressing again is the retry, because
    /// nothing here retries on its own.
    @Test
    func `a refused write leaves the control pressable and carries the reason`() {
        let state = WriteControlState.over(
            .admitted, attempt: .failed(.refused("Issues are disabled.")),
        )

        #expect(state.isEnabled)
        #expect(state.reason == "Issues are disabled.")
        #expect(!state.needsReconnect)
    }

    /// §7: a failing read does not prove a write will fail, read from the control's end.
    @Test
    func `a stale port still draws a pressable control`() {
        let stale = ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: account,
                health: BindingHealth(fault: .read(.offline), lastSuccess: nil),
            ),
        ])

        #expect(WriteControlState.over(stale.writes(through: .ticket), attempt: .idle) == .live)
    }

    @Test
    func `a port with no usable token disables the control and names the account`() {
        let state = WriteControlState.over(.refused(account), attempt: .idle)

        #expect(state == .blocked(account))
        #expect(!state.isEnabled)
        #expect(state.reason == "GitHub · milad-alizadeh · needs reconnect")
    }

    /// §7 disables that control "pointing at the same `Reconnect`", so the reading has to say that
    /// a repair exists — a reason with no act behind it names a fix nobody can press.
    @Test
    func `a dead token offers the reconnect, and a provider's refusal does not`() {
        #expect(WriteControlState.over(.refused(account), attempt: .idle).needsReconnect)
    }

    /// An unbound port is not a control to grey out. The room's own vacancy decides whether New
    /// ticket is drawn, so a reading that has not landed yet must not disable what it will admit.
    @Test
    func `a port with no binding leaves the control alone`() {
        #expect(WriteControlState.over(.noBinding, attempt: .idle) == .live)
        #expect(ConnectionHealthReading.quiet.writes(through: .ticket) == .noBinding)
    }

    /// A grant that died mid-flight does not un-press the button: the write is already on the wire,
    /// and both readings disable the control anyway.
    @Test
    func `a write in flight outranks a grant that has since been refused`() {
        #expect(WriteControlState.over(.refused(account), attempt: .pending) == .pending)
    }

    /// The reconnect outranks the last refusal's words, because it is the one with an action behind
    /// it.
    @Test
    func `a refused grant outranks the reason of the write that failed under it`() {
        let failed = WriteAttempt.failed(.refused("Bad credentials"))

        #expect(WriteControlState.over(.refused(account), attempt: failed) == .blocked(account))
    }
}
