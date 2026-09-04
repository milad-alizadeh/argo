import ArgoEngine
@testable import ArgoUI
import Testing

/// What a roster row's second line leads with (#1199): the newest call while the Session is
/// running, and the fact that tells the row apart every other time.
@Suite("Session roster activity")
struct SessionRosterActivityTests {
    @Test
    func `a running Session draws its newest call, in the feed's own words`() throws {
        let row = try #require(rows(status: .running, events: [
            ran("bun run lint", id: "one"),
            ran("bun run quality", id: "two"),
        ]).first)

        // The verb comes off `FeedCall.Kind.verb` and the subject off the feed's own reading:
        // one table of words, read by both surfaces.
        #expect(row.activity == "Ran bun run quality")
        #expect(row.leadingFact == "Ran bun run quality")
    }

    @Test(arguments: [
        (ToolCallKind.read, "Read SessionRow.swift"),
        (.edit, "Edited SessionRow.swift"),
        (.search, "Searched SessionRow.swift"),
    ])
    func `the verb is the call's own`(kind: ToolCallKind, line: String) throws {
        let row = try #require(rows(status: .running, events: [
            .toolCall(ToolCall(
                id: "one", name: "Read", kind: kind,
                target: "/Users/milad/Developer/argo/SessionRow.swift", atMs: nil,
            )),
        ]).first)

        // A file is named by its filename alone, at any width — the path is the panel's.
        #expect(row.activity == line)
    }

    @Test
    func `a call the record has not answered is still what the Session is doing`() throws {
        // A pending call is the LIVE one: waiting on it is the state the reader wants named.
        let row = try #require(rows(status: .running, events: [ran("swift test", id: "one")]).first)

        #expect(row.activity == "Ran swift test")
    }

    @Test(arguments: [
        SessionStatus.starting, .permission, .asking, .idle, .stopped, .ended, .unknown,
    ])
    func `every status but running keeps the fact the slot already carried`(
        status: SessionStatus,
    ) throws {
        // A call from ten minutes ago drawn as if it were live is the false DIRECT
        // `CONTEXT.md` degrade-down forbids.
        let row = try #require(rows(
            status: status, events: [ran("bun run quality", id: "one")],
        ).first)

        #expect(row.activity == nil)
        #expect(row.leadingFact == "/implement")
    }

    @Test
    func `a running Session that has emitted no call falls through rather than blanking`() throws {
        let row = try #require(rows(status: .running, events: [
            .message(markdown: "Reading the ticket first."),
        ]).first)

        #expect(row.activity == nil)
        #expect(row.leadingFact == "/implement")
    }

    @Test
    func `the slot says the activity or the ticket, never both`() throws {
        // A link with no title of its own, so the row keeps its derived title and the Ticket is
        // the fact the slot would otherwise carry (#1072).
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one",
                title: "Sort the roster's second line out",
                status: .running,
                events: [ran("bun run quality", id: "one")],
                ticket: .linked(.init(number: 1199)),
            ),
        ]).first)

        // First match wins: the ticket is the fact this row is missing while it is idle, and
        // what it is doing right now outranks it while it runs.
        #expect(row.toldApart == "#1199")
        #expect(row.leadingFact == "Ran bun run quality")
    }

    @Test
    func `a question the agent is holding is an ask and not this row's news`() throws {
        // The feed draws such a call as an ask row rather than a call row, so the roster reads
        // past it to the last thing the agent actually did.
        let row = try #require(rows(status: .running, events: [
            ran("bun run quality", id: "one"),
            .toolCall(ToolCall(
                id: "two", name: ToolCall.askUserQuestion, kind: .other, target: nil, atMs: nil,
                ask: Ask(questions: [Ask.Question(
                    text: "Which edge should the clock take?",
                    options: Ask.Option.labelled(["Leading", "Trailing"]),
                )]),
            )),
        ]).first)

        #expect(row.activity == "Ran bun run quality")
    }

    @Test
    func `a call the feed draws no row for is read past, not drawn blank`() throws {
        // The plan tool's writes are standing state with a surface of their own.
        let row = try #require(rows(status: .running, events: [
            ran("bun run quality", id: "one"),
            .toolCall(ToolCall(
                id: "two", name: "TodoWrite", kind: .plan, target: nil, atMs: nil,
            )),
        ]).first)

        #expect(row.activity == "Ran bun run quality")
    }

    @Test(arguments: [TranscriptEvent.turnEnded(.endTurn), .interrupted(atMs: nil)])
    func `a call from a Turn that ended is not what the Session is doing now`(
        boundary: TranscriptEvent,
    ) throws {
        // The walk stops at the open Turn's boundary: a call the Turn before is as stale as one
        // on an idle Session, and the row falls back rather than drawing it as live.
        let row = try #require(rows(status: .running, events: [
            ran("bun run quality", id: "one"),
            boundary,
            .prompt(text: "Now open the PR.", images: [], atMs: nil),
        ]).first)

        #expect(row.activity == nil)
        #expect(row.leadingFact == "/implement")
    }

    @Test
    func `a fold draws no activity, for the reason it draws no dot`() throws {
        // It stands for several runs at once, and one run's call drawn for all of them is a
        // claim about the others.
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                // Folded only where nobody can type at the run: a Session Argo owns the terminal
                // of keeps its own row whatever its record says it was started as.
                access: .external,
                entry: .headless,
                status: .running,
                events: [ran("bun run quality", id: "call-\(index)")],
            )
        }).first { $0.fold != nil })

        #expect(fold.activity == nil)
    }

    /// A Session the Ticket holds the title of, so its derived name is free to carry the slash
    /// command — which is the fact the slot falls through TO (#745).
    private func rows(status: SessionStatus, events: [TranscriptEvent])
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one",
                title: "/implement 1199",
                status: status,
                events: events,
                ticket: .linked(.init(
                    number: 1199,
                    title: "A roster row says what the Session is doing",
                )),
            ),
        ])
    }

    private func ran(_ command: String, id: String) -> TranscriptEvent {
        .toolCall(ToolCall(id: id, name: "Bash", kind: .execute, target: command, atMs: nil))
    }
}
