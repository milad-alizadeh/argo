import AppKit
import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// One Session that fanned out: three delegations, one still running — which is what keeps the rail
/// on screen at all — and two landed with a record each, the pair a reader clicks between.
///
/// Read through `SessionsRoomReading`, so the `FeedAgentReadings` it hands over is STAMPED. An
/// unstamped one derives every answer, which is a path the running app never takes.
@MainActor
enum FeedScopeFixture {
    static let saidByOne = "The first agent reported back."
    static let saidByTwo = "The second agent reported back."

    /// The cache is static, so a suite that means to count derivations empties it first — and one
    /// that only means to read rows still must not inherit another suite's entries.
    ///
    /// `grown` appends that many lines to the Session's own record, which is what a running Session
    /// does under the reader: it moves the stamp every one of these readings is remembered under.
    static func fanOut(grown: Int = 0, forgetting: Bool = true) -> SessionsRoomReading {
        if forgetting {
            SessionsRoomReadingCache.forget()
        }
        return SessionsRoomReading(presentation: presentation(grown: grown), sessionID: "one")
    }

    /// Which chip stands for one Subagent's record. The rail addresses a chip by its DELEGATION, so
    /// the id is looked up rather than written down.
    static func chip(_ subagent: String, in reading: SessionsRoomReading) -> FeedAgent.ID? {
        reading.readings.agents(in: reading.feed).first { $0.subagentID == subagent }?.id
    }

    static func presentation(grown: Int = 0) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [session(grown: grown)],
            checkout: .unavailable,
            connection: .idle,
        )
    }

    private static func session(grown: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .running,
            transcript: .init(
                events: events + (0 ..< grown).map { .message(markdown: "Line \($0).") },
                subagentEvents: [
                    "a-one": [.message(markdown: saidByOne)],
                    // Two lines, not one: the rows a scope draws have to be tellable apart from the
                    // other agent's by COUNT, which is all the table can be asked for.
                    "a-two": [.message(markdown: saidByTwo), .message(markdown: saidByTwo)],
                ],
            ),
        )
    }

    private static let events: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "run")),
        .toolCall(FeedFixture.call("one", tool: "Task", kind: .delegate, naming: "read")),
        .toolCallOutcome(TranscriptFixtures.spent("one", FeedFixture.delegated, subagent: "a-one")),
        .toolCall(FeedFixture.call("two", tool: "Task", kind: .delegate, naming: "sift")),
        .toolCallOutcome(TranscriptFixtures.spent("two", FeedFixture.delegated, subagent: "a-two")),
    ]
}

/// The deck hosted for real, through the ownership the shell actually has: the scope is a
/// SwiftUI `@State` of the view above the deck, exactly as `CockpitView.feedScope` is, and the rows
/// are read off the `NSTableView` the deck builds for itself.
///
/// The `@State` is the point. A `Binding(get:set:)` over a store allocates a fresh pair of closures
/// every pass, so it compares unequal every pass and re-renders whatever it is handed to — which
/// would pass this claim without proving it. The chip's write arrives through `asked` instead, and
/// the deck sees a state binding.
///
/// The precedent for hosting at all is `ComposerFieldKeyTests.Hosted`: a claim about the seam
/// between a SwiftUI tree and the AppKit view under it cannot be made from either side alone.
@MainActor final class HostedDeck {
    /// What the reader asked for, as the click leaves the rail. Read by the wrapper below and
    /// written into its `@State` — nothing outside SwiftUI can write a `@State` directly.
    @Observable final class Asked {
        var scope = FeedScope.session
        /// How many lines the Session has said since the deck opened — a running transcript, which
        /// moves the stamp the readings are remembered under.
        var grown = 0
    }

    let asked: Asked
    let host: NSHostingView<AnyView>
    let window: NSWindow

    init() {
        let asked = Asked()
        self.asked = asked
        SessionsRoomReadingCache.forget()
        self.host = NSHostingView(rootView: AnyView(
            HostedDeckWrapper(asked: asked).argoAppearance(),
        ))
        host.frame = NSRect(x: 0, y: 0, width: 1000, height: 600)
        self.window = NSWindow(
            contentRect: host.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: false,
        )
        window.contentView = host
        host.layoutSubtreeIfNeeded()
        settle()
    }

    /// The feed's own table, found by type rather than held: the deck builds it, and the whole
    /// point
    /// of the claim is that nothing here reaches inside the deck to make one.
    var table: FeedTableView {
        get throws {
            try #require(Self.table(in: host), "The hosted deck built no feed table.")
        }
    }

    /// How many rows the table is drawing right now.
    var drawnRows: Int {
        get throws { try table.numberOfRows }
    }

    /// One chip clicked — see `AgentsRail.select(_:)`, which writes exactly this.
    func scope(onto subagent: String) throws {
        let agent = try #require(
            FeedScopeFixture.chip(subagent, in: FeedScopeFixture.fanOut(
                grown: asked.grown, forgetting: false,
            )),
            "No chip stands for \(subagent).",
        )
        asked.scope = .subagent(agent)
        settle()
    }

    /// The Session says one more line, as the Hub publishes it — a fresh stamp under the reader.
    func grow() {
        asked.grown += 1
        settle()
    }

    /// The same chip clicked again, which is how the rail leads back out.
    func scopeBack() {
        asked.scope = .session
        settle()
    }

    /// Turns the run loop, then lays out. SwiftUI applies a state write on a turn of its own, so a
    /// layout pass is a request for the update rather than a promise of it.
    func settle() {
        for _ in 0 ... FeedTableCoordinator.panePasses {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.002))
            host.layoutSubtreeIfNeeded()
        }
    }

    private static func table(in view: NSView) -> FeedTableView? {
        if let table = view as? FeedTableView {
            return table
        }
        for child in view.subviews {
            if let found = table(in: child) {
                return found
            }
        }
        return nil
    }
}

/// `CockpitView`'s half of the wiring, and only that half: the scope and the height stores held as
/// state above the deck, handed down as a binding and an environment value.
private struct HostedDeckWrapper: View {
    let asked: HostedDeck.Asked

    @State private var scope = FeedScope.session
    @State private var geometries = FeedGeometries()

    /// Taken per pass off the presentation, exactly as `CockpitView.body` takes it (#957).
    private var reading: SessionsRoomReading {
        SessionsRoomReading(
            presentation: FeedScopeFixture.presentation(grown: asked.grown),
            sessionID: "one",
        )
    }

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            session: "one",
            feed: reading.feed,
            header: reading.header,
            readings: reading.readings,
            scope: $scope,
        )
        .environment(\.argoFeedGeometries, geometries)
        .onChange(of: asked.scope, initial: true) { _, asked in scope = asked }
    }
}
