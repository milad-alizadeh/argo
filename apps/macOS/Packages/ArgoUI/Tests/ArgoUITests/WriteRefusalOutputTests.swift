import ArgoEngine
@testable import ArgoUI
import Testing

/// Which refusals put unabridged output one gesture behind their line (§5), and which are a
/// sentence Argo worded itself with nothing behind it to open.
@Suite("Write refusal output")
struct WriteRefusalOutputTests {
    static let validation = """
    Validation Failed: title is too long (maximum is 256 characters)
    See https://docs.github.com/rest/issues/issues#create-an-issue
    """

    @Test
    func `a provider's refusal carries its own words unabridged`() {
        #expect(TicketWriteError.refused(Self.validation).output?.text == Self.validation)
    }

    @Test
    func `the line a refusal says is the first line of what it carries`() {
        #expect(TicketWriteError.refused(Self.validation).reason
            == "Validation Failed: title is too long (maximum is 256 characters)")
    }

    /// Argo asked the provider nothing, so the provider printed nothing.
    @Test(arguments: [
        TicketWriteError.unavailable(.labels),
        TicketWriteError.inexpressible(.inReview),
        TicketWriteError.illegalTransition(from: .todo, to: .done),
    ])
    func `a write Argo refused itself carries no output`(refusal: TicketWriteError) {
        #expect(refusal.output == nil)
    }

    @Test
    func `a write that never reached the provider carries no output`() {
        #expect(TicketWriteError.unreachable(.rateLimited).output == nil)
    }

    @Test
    func `a refused write offers the gesture at its control`() {
        #expect(WriteControlState.refused(.refused(Self.validation)).output?.text
            == Self.validation)
    }

    /// §7 gives this control a Reconnect rather than an output: a dead token is an Account fact
    /// Argo words itself.
    @Test
    func `a control with no usable token offers no output`() {
        #expect(WriteControlState.blocked(ConnectFixture.personal).output == nil)
    }

    @Test
    func `a write still on the wire has printed nothing to offer`() {
        #expect(WriteControlState.pending.output == nil)
    }

    @Test
    func `a control that has not failed offers no output`() {
        #expect(WriteControlState.live.output == nil)
    }
}
