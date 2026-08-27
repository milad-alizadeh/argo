import ArgoEngine
@testable import ArgoUI
import Testing

/// Who gets a composer at all, and what it states — the projection's honesty claims.
@Suite("Session composer projection")
struct SessionComposerProjectionTests {
    @Test
    func `a managed live Session gets a composer addressed to its agent`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, status: .idle)),
        )

        #expect(composer.sessionID == "session-a")
        #expect(composer.placeholder == "Message Claude Code…")
        #expect(composer.facts == "Opus 5")
        #expect(!composer.isRunning)
    }

    /// While a Turn is in flight the field says what send will actually do — hold the words —
    /// rather than going on offering to message an agent that is mid-sentence (decision 4).
    @Test
    func `a Session mid-Turn invites a follow-up rather than a message`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, status: .running)),
        )

        #expect(composer.isRunning)
        #expect(composer.placeholder == "Queue a follow-up…")
    }

    /// Blocked is not running. A Session waiting on a Permission or a question has no Turn in
    /// flight to queue behind, so the next thing typed goes straight to it.
    @Test(arguments: [SessionStatus.permission, .asking, .idle, .stopped, .unknown])
    func `a Session that is not mid-Turn takes the next words itself`(
        status: SessionStatus,
    ) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, status: status)),
        )
        #expect(!composer.isRunning)
    }

    /// Absent, not disabled: a greyed field invites a click and gives no reason. `external` was
    /// never Argo's to drive and `orphaned` lost the PTY it had — neither can take a keystroke.
    @Test(arguments: [
        CockpitPresentation.Session.Access.external,
        CockpitPresentation.Session.Access.orphaned,
    ])
    func `a Session Argo cannot drive gets no composer at all`(
        access: CockpitPresentation.Session.Access,
    ) {
        #expect(SessionComposerProjection.composer(for: session(access: access)) == nil)
    }

    @Test
    func `an ended Session gets no composer even though Argo owned it`() {
        let ended = session(access: .managed, status: .ended)
        #expect(SessionComposerProjection.composer(for: ended) == nil)
    }

    @Test
    func `no Session selected is no composer`() {
        #expect(SessionComposerProjection.composer(for: nil) == nil)
    }

    /// A managed Session's first moments are a claim without a record behind it — no CLI named
    /// yet, so the field is addressed to the role rather than inventing an agent.
    @Test
    func `a Session whose record named no CLI is addressed generically`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(
                for: session(access: .managed, status: .idle, cli: nil),
            ),
        )
        #expect(composer.placeholder == "Message the agent…")
    }

    /// Composed of what is present: no model is no facts, never a placeholder keeping the line
    /// company.
    @Test
    func `a Session whose record named no model states no facts`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, model: nil)),
        )
        #expect(composer.facts == nil)
    }

    /// An id the model table does not know is stated verbatim — ugly-but-true beats the nearest
    /// guess.
    @Test
    func `an unknown model id is stated verbatim`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(
                for: session(access: .managed, model: "brand-new-model"),
            ),
        )
        #expect(composer.facts == "brand-new-model")
    }

    /// The stance is carried WHOLE rather than reduced to a rung: the `≈` and the CLI's own word
    /// are both things the control draws, and a rung alone cannot say either (#545).
    @Test(arguments: [
        SessionModeReading.exactly(.code, cli: "acceptEdits"),
        SessionModeReading.nearly(.readOnly, cli: "default"),
        SessionModeReading.unknown(cli: "dontAsk"),
        SessionModeReading.unknown(cli: nil),
    ])
    func `the composer carries the Session's stance as the Hub read it`(
        mode: SessionModeReading,
    ) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, mode: mode)),
        )
        #expect(composer.mode == mode)
    }

    private func session(
        access: CockpitPresentation.Session.Access,
        status: SessionStatus = .running,
        cli: AgentCLI? = .claude,
        model: String? = "claude-opus-5",
        mode: SessionModeReading = .unknown(cli: nil),
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-a",
            title: "Restore the sessions Warp closed",
            access: access,
            status: status,
            chain: .init(cli: cli, model: model),
            autonomy: .init(mode: mode),
        )
    }
}
