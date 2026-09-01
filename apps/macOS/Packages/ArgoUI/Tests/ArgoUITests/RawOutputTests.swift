import ArgoEngine
@testable import ArgoUI
import Testing

/// What a failed operation printed, and which one line of it stands at the control
/// (`cockpit-failure-states-spec.md` §5). The rule this suite exists for is git's:
/// `! [rejected] …` followed by the `hint:` that tells you to pull, where the first line names the
/// failure and every line after it is the fix.
@Suite("Raw output")
struct RawOutputTests {
    static let rejectedPush = """
    ! [rejected]        main -> main (fetch first)
    error: failed to push some refs to 'github.com:milad-alizadeh/argo.git'
    hint: Updates were rejected because the remote contains work that you do
    hint: not have locally.
    """

    @Test
    func `the line at the control is the output's first line`() {
        #expect(RawOutput(Self.rejectedPush)?.summary
            == "! [rejected]        main -> main (fetch first)")
    }

    /// The clause the whole rule exists for: the hint that says how to fix it is three lines below
    /// the line anybody reads, so anything that keeps only the summary keeps the useless half.
    @Test
    func `the output behind the line keeps every character of it`() {
        #expect(RawOutput(Self.rejectedPush)?.text == Self.rejectedPush)
    }

    @Test
    func `a blank opening line is not the line at the control`() {
        #expect(RawOutput("\n\n  Validation Failed: title is too long")?.summary
            == "Validation Failed: title is too long")
    }

    /// A gesture onto an empty panel is a promise broken, so an operation that printed nothing
    /// offers none.
    @Test
    func `an operation that printed nothing has no output to open`() {
        #expect(RawOutput("   \n\n ") == nil)
    }
}

/// Which refusals have unabridged output behind them and which are Argo's own sentence, with
/// nothing behind it to open.
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

    /// The line is the output's first line, so the reader is never shown a sentence the output
    /// does not contain.
    @Test
    func `the line a refusal says is the first line of what it carries`() {
        #expect(TicketWriteError.refused(Self.validation).reason
            == "Validation Failed: title is too long (maximum is 256 characters)")
    }

    /// Argo asked the provider nothing, so the provider printed nothing.
    @Test
    func `a write Argo refused itself carries no output`() {
        #expect(TicketWriteError.unavailable(.labels).output == nil)
        #expect(TicketWriteError.inexpressible(.inReview).output == nil)
        #expect(TicketWriteError.illegalTransition(from: .todo, to: .done).output == nil)
    }

    @Test
    func `a write that never reached the provider carries no output`() {
        #expect(TicketWriteError.unreachable(.rateLimited).output == nil)
    }

    @Test
    func `a refused write offers the gesture at its control`() {
        let control = WriteControlState.refused(.refused(Self.validation))

        #expect(control.output?.text == Self.validation)
    }

    /// A dead token is an Account fact Argo words itself, and §7 gives that control a Reconnect
    /// rather than an output.
    @Test
    func `a control with no usable token offers no output`() {
        #expect(WriteControlState.blocked(ConnectFixture.personal).output == nil)
        #expect(WriteControlState.pending.output == nil)
        #expect(WriteControlState.live.output == nil)
    }
}
