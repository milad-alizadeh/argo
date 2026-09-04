import ArgoEngine
@testable import ArgoUI
import Testing

/// The titlebar title's hover is the ONLY place the header's facts and the tab line's telemetry
/// are still said (#692). A headless screenshot cannot capture a native tooltip, so this suite is
/// what holds the string to the design — nothing renders it where an eye could check it.
@Suite("Session header tooltip")
struct SessionHeaderTooltipTests {
    @Test
    func `the hover carries the facts and then the telemetry, in the design's order`() throws {
        let header = SessionHeaderProjection.header(from: fullSession())

        let lines = try #require(header.tooltip).components(separatedBy: "\n")

        #expect(lines.count == 6)
        #expect(lines[0] == "Claude Code")
        // The marks hang off the branch, on the line the fact line drew them on.
        // The worktree folder is named here too (#1199): the roster row stopped drawing it.
        #expect(lines[1] == "On argo/#692-titlebar-title, in the worktree tkt-692 "
            + "· 3 uncommitted files")
        #expect(lines[2] == "Issue #692 — Titlebar title")
        #expect(lines[3] == "Argo never owned this Session's terminal, "
            + "so it cannot be driven from here.")
        // The blank line is what separates identity from telemetry: the facts above it say what
        // the Session IS, and the run below says what it has spent.
        #expect(lines[4].isEmpty)
        #expect(lines[5] == header.spend)
    }

    /// One line, not two: the telemetry is the tab line's own words, unchanged by the move.
    @Test
    func `the telemetry is the spend the tab line drew, verbatim`() throws {
        let header = SessionHeaderProjection.header(from: fullSession())

        let spend = try #require(header.spend)
        #expect(try #require(header.tooltip).hasSuffix("\n\n" + spend))
        #expect(spend.contains("tokens spent"))
    }

    /// A managed Session spends no access word, so the hover must close on the issue rather than
    /// open a line for a posture it does not have.
    @Test
    func `a managed Session's hover names no posture`() throws {
        let header = SessionHeaderProjection.header(from: fullSession(access: .managed))

        let tooltip = try #require(header.tooltip)
        #expect(!tooltip.contains("cannot be driven"))
        #expect(tooltip.components(separatedBy: "\n").count == 5)
    }

    /// The blank line is drawn BETWEEN the two halves, never around a missing one — a hover ending
    /// on an empty line is a fact the reader is left looking for.
    @Test
    func `a Session with no telemetry stops at its facts`() {
        let header = SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "tooltip-factsonly",
            title: "A Session nothing was spent on",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
        ))

        #expect(header.spend == nil)
        #expect(header.tooltip == "Claude Code")
    }

    /// Absent, not empty: `.help("")` still draws a tooltip chip over the title, which reads as a
    /// fact that failed to load rather than as a Session nothing is known about.
    @Test
    func `a Session nothing could be read from offers no hover at all`() {
        let header = SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "tooltip-empty",
            title: "A Session read off an empty record",
            access: .managed,
            status: .idle,
        ))

        #expect(header.tooltip == nil)
    }

    /// Every fact the hover can carry, on one Session — the only reading where the full order is
    /// visible. Spend is real rather than stubbed, so the last line is the tab line's own string.
    private func fullSession(
        access: CockpitPresentation.Session.Access = .external,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "tooltip-full",
            title: "The Session title becomes the window's document title",
            access: access,
            status: .idle,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                span: .init(startedAtMs: 0, lastSeenAtMs: 3_600_000),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-692",
                workspace: .init(kind: .worktree, branch: "argo/#692-titlebar-title", dirty: 3),
                ticket: .linked(.init(number: 692, title: "Titlebar title")),
            ),
            spend: .init(spentTokens: 1_830_000, cachedTokens: 28_100_000, context: .held(216_764)),
        )
    }
}
