import ArgoEngine
@testable import ArgoUI
import Testing

/// What takes the composer's slot when there is no composer — one line saying why, rather than the
/// blank deck foot a reader cannot tell from a screen that failed to draw (#546, design decision
/// 7).
@Suite("Composer unavailable")
struct ComposerUnavailableTests {
    @Test(arguments: [
        (
            CockpitPresentation.Session.Access.external,
            SessionComposerProjection.Unavailable.external,
        ),
        (.orphaned, .orphaned),
    ])
    func `a Session Argo cannot drive says which kind of undriveable it is`(
        access: CockpitPresentation.Session.Access,
        reason: SessionComposerProjection.Unavailable,
    ) {
        #expect(SessionComposerProjection.unavailable(for: session(access: access)) == reason)
    }

    /// A companion can report `ended` on a Session whose PTY Argo still holds, so this is neither
    /// of the two the study drew: nothing died, the Session is simply over.
    @Test
    func `a managed Session its agent reported over says so in its own words`() {
        let ended = session(access: .managed, status: .ended)
        #expect(SessionComposerProjection.unavailable(for: ended) == .ended)
    }

    /// The two readings are one decision, so a Session can never have both or neither.
    @Test(arguments: CockpitPresentation.Session.Access.allCases)
    func `a Session gets a composer or a reason and never both`(
        access: CockpitPresentation.Session.Access,
    ) {
        let live = session(access: access)
        let composer = SessionComposerProjection.composer(for: live)
        let unavailable = SessionComposerProjection.unavailable(for: live)

        #expect((composer == nil) == (unavailable != nil))
    }

    @Test
    func `no Session selected is neither a composer nor a reason`() {
        #expect(SessionComposerProjection.unavailable(for: nil) == nil)
    }

    /// The second clause is the whole point: an external Session raises no Permission because Argo
    /// holds no gate on it, and a reader who is told only "read-only" reads that silence as
    /// consent.
    @Test
    func `an external Session states that Permission is unobservable and not granted`() {
        #expect(SessionComposerProjection.Unavailable.external.word == "Read-only")
        #expect(
            SessionComposerProjection.Unavailable.external.detail
                .contains("Permission here is unobservable, not granted"),
        )
    }

    @Test
    func `an orphaned Session names the channel that died rather than blaming the Session`() {
        #expect(SessionComposerProjection.Unavailable.orphaned.word == "Orphaned")
        #expect(
            SessionComposerProjection.Unavailable.orphaned.detail
                .contains("steering channel died with the process that owned it"),
        )
    }

    /// The one act actually available on a Session that was Argo's and is now past steering. An
    /// external Session gets none: Argo never owned it, so a fresh Session beside it is a guess
    /// about what the reader wanted rather than the way on from where they are.
    @Test(arguments: [
        (SessionComposerProjection.Unavailable.orphaned, true),
        (.ended, true),
        (.external, false),
    ])
    func `only a Session that was Argo's offers a fresh one on its branch`(
        reason: SessionComposerProjection.Unavailable,
        offersFreshSession: Bool,
    ) {
        #expect(reason.offersFreshSession == offersFreshSession)
    }

    /// The reading is what a glance takes off the line, so two of them may never read alike.
    @Test
    func `no two reasons share a word`() {
        let reasons = SessionComposerProjection.Unavailable.allCases

        #expect(Set(reasons.map(\.word)).count == reasons.count)
    }

    /// The mark is what tells them apart before the sentence is read at all.
    @Test
    func `no two reasons share a mark`() {
        let reasons = SessionComposerProjection.Unavailable.allCases

        #expect(Set(reasons.map(\.mark)).count == reasons.count)
    }

    /// A reason with no sentence is the blank foot this whole line exists to replace.
    @Test
    func `every reason says why in words`() {
        #expect(SessionComposerProjection.Unavailable.allCases.allSatisfy { !$0.detail.isEmpty })
    }

    /// An Allow answers a gate, and an undriveable Session has none left to answer — so the slot
    /// takes the line rather than a decision that cannot land. The engine already withdraws a
    /// claim's pending Permissions when its PTY exits; this is that refusal said where it is DRAWN.
    @Test(arguments: [
        CockpitPresentation.Session.Access.external,
        CockpitPresentation.Session.Access.orphaned,
    ])
    func `a Session Argo cannot drive raises no prompt either`(
        access: CockpitPresentation.Session.Access,
    ) {
        let blocked = session(access: access, permission: waiting)

        #expect(PermissionPromptProjection.prompt(for: blocked) == nil)
        #expect(SessionComposerProjection.unavailable(for: blocked) != nil)
    }

    /// The same Permission on a Session Argo DOES hold, so the guard above is a claim about access
    /// rather than a prompt that stopped working.
    @Test
    func `the same Permission on a managed Session still raises one`() {
        let blocked = session(access: .managed, permission: waiting)

        #expect(PermissionPromptProjection.prompt(for: blocked) != nil)
    }

    private let waiting = PermissionRequest(
        id: "permission-1",
        toolName: "Bash",
        target: .command("rm -rf build"),
    )

    private func session(
        access: CockpitPresentation.Session.Access,
        status: SessionStatus = .idle,
        permission: PermissionRequest? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-a",
            title: "Graphite and Ion Blue across the shell",
            model: "claude-opus-5",
            workspaceLocation: nil,
            access: access,
            status: status,
            cli: .claude,
            permission: permission,
        )
    }
}
