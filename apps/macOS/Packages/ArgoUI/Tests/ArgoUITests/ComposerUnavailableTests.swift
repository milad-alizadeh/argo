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

    /// Every reason is a sentence somebody has to read, so none of them may be empty and none may
    /// borrow another's mark — the mark is what tells them apart at a glance.
    @Test
    func `every reason carries its own word, sentence and mark`() {
        let reasons = SessionComposerProjection.Unavailable.allCases

        #expect(Set(reasons.map(\.word)).count == reasons.count)
        #expect(reasons.allSatisfy { !$0.detail.isEmpty })
        #expect(Set(reasons.map(\.mark)).count == reasons.count)
    }

    private func session(
        access: CockpitPresentation.Session.Access,
        status: SessionStatus = .idle,
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
        )
    }
}
