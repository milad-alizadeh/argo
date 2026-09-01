@testable import ArgoUI
import Testing

/// What a failed operation printed, and which one line of it stands at the control
/// (`cockpit-failure-states-spec.md` §5).
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
    /// the line anybody reads.
    @Test
    func `the output behind the line keeps every character of it`() {
        #expect(RawOutput(Self.rejectedPush)?.text == Self.rejectedPush)
    }

    @Test
    func `a blank opening line is not the line at the control`() {
        #expect(RawOutput("\n\n  Validation Failed: title is too long")?.summary
            == "Validation Failed: title is too long")
    }

    /// A body off the wire breaks its lines the way its sender did, and a `\r` left on the end of
    /// the summary draws as a box.
    @Test
    func `a line broken the wire's way carries no return into the summary`() {
        #expect(RawOutput("Validation Failed\r\nSee the docs\r\n")?.summary
            == "Validation Failed")
    }

    /// A gesture onto an empty panel is a promise broken.
    @Test
    func `an operation that printed nothing has no output to open`() {
        #expect(RawOutput("   \n\n ") == nil)
    }
}
