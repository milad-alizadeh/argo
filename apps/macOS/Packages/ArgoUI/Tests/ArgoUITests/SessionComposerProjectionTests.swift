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
        #expect(composer.facts.words == "Opus 5 · Medium")
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

    /// The line no longer goes missing (#558): it is one of TWO facts now, so an absent model would
    /// leave a fact line stating half of what it is for. `unknown` on the missing half is the
    /// degrade-down answer, and the effort beside it is still stated.
    @Test
    func `a Session whose record named no model states unknown for it alone`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed, model: nil)),
        )
        #expect(composer.facts.words == "unknown · Medium")
        #expect(composer.facts.tickedModel == nil)
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
        #expect(composer.facts.modelWords == "brand-new-model")
    }

    /// The same rule on the other knob (#558): a level off Argo's own ladder states itself rather
    /// than rounding to a neighbour, and the id it came in as is still readable behind it.
    @Test
    func `an effort level Argo does not recognise is stated verbatim`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(
                for: session(access: .managed, effort: "ludicrous"),
            ),
        )
        #expect(composer.facts.words == "Opus 5 · ludicrous")
        #expect(composer.facts.effort.rung == nil)
    }

    /// Neither fact established reads as the WORD, on both halves — never a plausible value.
    @Test
    func `a Session whose records named neither fact reads unknown`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(
                for: session(access: .managed, model: nil, effort: nil),
            ),
        )
        #expect(composer.facts.words == "unknown · unknown")
        #expect(!composer.facts.isDefault)
    }

    /// Declared, not discovered (#558): a projection built with no capabilities draws no popover,
    /// so the fact line has nothing to open.
    @Test
    func `an adapter declaring neither knob leaves the facts unopenable`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(access: .managed)),
        )
        #expect(!composer.facts.canOpen)
    }

    @Test
    func `an adapter declaring one knob is openable on that one alone`() throws {
        let composer = try #require(SessionComposerProjection.composer(
            for: session(access: .managed),
            can: .init(chooses: RunFactKnobs(effort: true)),
        ))
        #expect(composer.facts.canOpen)
        #expect(!composer.facts.chooses.model)
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

    /// Internal rather than private: the prompt claims live in
    /// `SessionComposerProjectionTests+Prompt.swift`, which builds its Sessions with this one.
    func session(
        access: CockpitPresentation.Session.Access,
        status: SessionStatus = .running,
        cli: AgentCLI? = .claude,
        model: String? = "claude-opus-5",
        effort: String? = "medium",
        mode: SessionModeReading = .unknown(cli: nil),
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-a",
            title: "Restore the sessions Warp closed",
            access: access,
            status: status,
            chain: .init(program: .init(cli: cli, model: model, effort: effort)),
            autonomy: .init(mode: mode),
        )
    }
}
