import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the CLI's own prompt is free to take a line typed at it (#1217).
///
/// Its own file rather than two more claims in the suite beside it: what those settle is who gets a
/// composer and what it states, and this is one fact about the Session behind it — the one the
/// run-settings popover draws its two knobs inert under.
extension SessionComposerProjectionTests {
    /// Blocked is not running, and it is not free either. A Permission or a question hands the
    /// CLI's keyboard to a DIALOG, so a `/model` line typed then is eaten by it — which is why the
    /// run-settings knobs are locked on more statuses than the queue holds words on.
    @Test(arguments: [SessionStatus.running, .permission, .asking])
    func `a Session whose prompt is held takes no typed line`(status: SessionStatus) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, status: status)),
        )

        #expect(!composer.takesTypedLine)
    }

    /// And a Session at its own prompt does. `starting` among them: Argo has written the argv and
    /// the prompt is on its way, which is not the same as one held by something else.
    @Test(arguments: [SessionStatus.idle, .starting, .stopped, .unknown])
    func `a Session at its own prompt takes a typed line`(status: SessionStatus) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, status: status)),
        )

        #expect(composer.takesTypedLine)
    }
}
