import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which connect notes put the provider's unabridged answer one gesture behind their middle line
/// (§5 of `cockpit-failure-states-spec.md`), and which are Argo's own three sentences (#1045).
@Suite("Connect note output")
struct ConnectNoteOutputTests {
    /// A provider body of the shape that made this rule: the first line names the refusal, and the
    /// lines under it are the only text that says what to change.
    static let refusal = """
    Your organisation blocks OAuth Apps that request repo access.
    Ask an owner to approve Argo at https://github.com/organizations/trili/settings/oauth_application_policy
    """

    static let firstLine = "Your organisation blocks OAuth Apps that request repo access."

    /// A failure with no `BindingRefusal` of its own: the transport, or the write behind it.
    @Test
    func `a failure Argo has no word for carries what it said`() {
        let refused = URLError(.notConnectedToInternet)
        let note = ConnectNote(unreadable: refused)

        #expect(note.why == refused.localizedDescription)
        #expect(note.output?.text == refused.localizedDescription)
    }

    @Test
    func `a device flow the provider refused carries its whole answer`() {
        let note = ConnectNote(
            deviceFlow: .refused(code: "access_denied", description: Self.refusal),
            provider: .github,
        )

        #expect(note.why == Self.firstLine)
        #expect(note.output?.text == Self.refusal)
    }

    /// A refusal with no body of its own: the code IS the answer, and the line is the whole of it.
    @Test
    func `a device flow refused with only a code offers that code`() {
        let note = ConnectNote(
            deviceFlow: .refused(code: "access_denied", description: ""),
            provider: .github,
        )

        #expect(note.why == "access_denied")
        #expect(note.output?.text == "access_denied")
    }

    @Test
    func `a redirect grant the provider refused carries its whole answer`() {
        let note = ConnectNote(authorization: .refused(Self.refusal), provider: .linear)

        #expect(note.why == Self.firstLine)
        #expect(note.output?.text == Self.refusal)
    }

    /// A failure that is not the flow's own falls to the same catch-all, and keeps its words.
    @Test
    func `a grant that failed outside the flow carries what it said`() {
        let note = ConnectNote(grant: URLError(.notConnectedToInternet), provider: .github)

        #expect(note.output?.text == URLError(.notConnectedToInternet).localizedDescription)
    }

    /// `BindingRefusal` is Argo's own vocabulary throughout — `unreadable` included, whose reason
    /// every engine site that raises one writes itself. None of them is a provider's printed text.
    @Test(arguments: [
        BindingRefusal.noSuchProject,
        .noSuchAccount,
        .noGrant,
        .grantExpired,
        .unauthorized,
        .scopeNotVisible("milad-alizadeh/argo"),
        .unreadable("GitHub could not be reached."),
    ])
    func `a refusal Argo worded itself offers nothing to open`(refusal: BindingRefusal) {
        #expect(ConnectNote(refusal: refusal).output == nil)
    }

    @Test(arguments: [
        BindingFault.accountRemoved,
        .portNotServedByProvider,
        .grantMissing,
        .grantExpired,
    ])
    func `a binding that no longer reads offers nothing to open`(fault: BindingFault) {
        #expect(ConnectNote(fault: fault).output == nil)
    }

    @Test
    func `a provider this build cannot sign in to offers nothing to open`() {
        #expect(ConnectNote.notYetAuthorizable(.linear).output == nil)
    }
}
