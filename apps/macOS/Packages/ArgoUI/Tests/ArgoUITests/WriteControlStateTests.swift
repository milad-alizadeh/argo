import ArgoEngine
@testable import ArgoUI
import Testing

/// What one provider-port write control renders, folded from what the port admits and where the
/// last attempt got to (`cockpit-failure-states-spec.md` §4, §7).
@Suite("Write control state")
struct WriteControlStateTests {
    private let work = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "milad-alizadeh",
    )

    @Test
    func `an admitted port with nothing in flight is pressable`() {
        let state = WriteControlState.over(.admitted, .idle)

        #expect(state == .live)
        #expect(state.isEnabled)
        #expect(state.isDrawn)
        #expect(state.reason == nil)
    }

    @Test
    func `a write in flight disables the control and says nothing`() {
        let state = WriteControlState.over(.admitted, .pending)

        #expect(state == .pending)
        #expect(!state.isEnabled)
        #expect(state.isDrawn)
        #expect(state.reason == nil)
    }

    /// §4: failure returns the control to its prior state. Pressing again is the retry, because
    /// nothing here retries on its own.
    @Test
    func `a refused write leaves the control pressable and carries the reason`() {
        let state = WriteControlState.over(.admitted, .failed(.refused("Issues are disabled.")))

        #expect(state.isEnabled)
        #expect(state.reason == "Issues are disabled.")
    }

    /// §7: a failing read does not prove a write will fail, so `stale` is `admitted` and reaches
    /// here as `live` — this is the same claim the admission's own suite makes, read from the
    /// control's end.
    @Test
    func `a stale port still draws a pressable control`() {
        let stale = ConnectionHealthReading(connections: [
            PortConnection(
                port: .workItem,
                account: work,
                health: BindingHealth(fault: .read(.offline), lastSuccess: nil),
            ),
        ])

        #expect(WriteControlState.over(stale.writes(through: .workItem), .idle) == .live)
    }

    @Test
    func `a port with no usable token disables the control and names the account`() {
        let state = WriteControlState.over(.refused(work), .idle)

        #expect(state == .blocked(work))
        #expect(!state.isEnabled)
        #expect(state.reason == "Reconnect milad-alizadeh on GitHub")
    }

    @Test
    func `a port with no binding draws no control at all`() {
        let state = WriteControlState.over(.noBinding, .idle)

        #expect(state == .absent)
        #expect(!state.isDrawn)
    }

    /// A grant that died mid-flight does not un-press the button: the write is already on the wire,
    /// and both readings disable the control anyway. `pending` is the truer of the two.
    @Test
    func `a write in flight outranks a grant that has since been refused`() {
        #expect(WriteControlState.over(.refused(work), .pending) == .pending)
    }

    /// The reconnect outranks the last refusal's words, because it is the one of the two with an
    /// action behind it.
    @Test
    func `a refused grant outranks the reason of the write that failed under it`() {
        let failed = WriteAttempt.failed(.refused("Bad credentials"))

        #expect(WriteControlState.over(.refused(work), failed) == .blocked(work))
    }

    @Test
    func `an unbound port draws nothing even with a write recorded against it`() {
        #expect(WriteControlState.over(.noBinding, .pending) == .absent)
    }
}
