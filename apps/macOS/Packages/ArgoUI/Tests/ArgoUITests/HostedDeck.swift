import AppKit
import ArgoDesign
@testable import ArgoUI
import SwiftUI
import Testing

/// The deck hosted for real, through the ownership the shell actually has: the scope is a
/// SwiftUI `@State` of the view above the deck, exactly as `CockpitView.feedScope` is, and the rows
/// are read off the `NSTableView` the deck builds for itself.
///
/// The `@State` is the point. A `Binding(get:set:)` over a store allocates a fresh pair of closures
/// every pass, so it compares unequal every pass and re-renders whatever it is handed to — which
/// would pass this claim without proving it. The chip's write arrives through `asked` instead, and
/// the deck sees a state binding.
///
/// The precedent for hosting at all is `ComposerFieldHost`: a claim about the seam
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
    /// point of the claim is that nothing here reaches inside the deck to make one.
    var table: FeedTableView {
        get throws {
            try #require(
                Self.find(FeedTableView.self, in: host), "The hosted deck built no feed table.",
            )
        }
    }

    /// How many rows the table is drawing right now.
    var drawnRows: Int {
        get throws { try table.numberOfRows }
    }

    /// The table's own delegate, which is the coordinator the deck built — the one thing that can
    /// say what a row's height WOULD be asked as, beside what it is drawn at.
    var coordinator: FeedTableCoordinator {
        get throws {
            try #require(table.delegate as? FeedTableCoordinator, "The feed table has no delegate.")
        }
    }

    /// The overview lane the deck put beside that feed.
    var lane: MinimapLaneView {
        get throws {
            try #require(Self.find(MinimapLaneView.self, in: host), "The deck built no lane.")
        }
    }

    /// Every row as the table has it laid out, paired with what the coordinator would answer for it
    /// now. A reading measured as itself has the two equal at every row; one drawn at the last
    /// reading's rhythm does not.
    func heights() throws -> [(drawn: CGFloat, asked: CGFloat)] {
        let table = try table
        let coordinator = try coordinator
        return (0 ..< table.numberOfRows).map {
            (table.rect(ofRow: $0).height, coordinator.measuredHeight(at: $0, in: table))
        }
    }

    /// One chip clicked — see `AgentsRail.select(_:)`, which writes exactly this.
    func scope(onto subagent: String) async throws {
        let agent = try #require(
            FeedScopeFixture.chip(subagent, in: FeedScopeFixture.fanOut(
                grown: asked.grown, forgetting: false,
            )),
            "No chip stands for \(subagent).",
        )
        asked.scope = .subagent(agent)
        await settled()
    }

    /// The Session says one more line, as the Hub publishes it — a fresh stamp under the reader.
    func grow() async {
        asked.grown += 1
        await settled()
    }

    /// The same chip clicked again, which is how the rail leads back out.
    func scopeBack() async {
        asked.scope = .session
        await settled()
    }

    /// Turns the run loop, then lays out. SwiftUI applies a state write on a turn of its own, so a
    /// layout pass is a request for the update rather than a promise of it.
    ///
    /// It runs until the deck has a settled document as well: the whole-document measure is a
    /// `Task` (ADR-0030, Rule 3), so the table draws no row until a turn of this loop has let one
    /// land. Bounded, so a pass that never comes back fails a case rather than hanging it.
    /// The same, with the whole-document measure run out.
    ///
    /// The measure is a `Task` (ADR-0030, Rule 3), and a task's continuation cannot be reached by
    /// turning the run loop from inside a synchronous main-actor call — the call IS the main actor.
    /// So a caller that needs the deck DRAWING rather than merely laid out awaits this one.
    func settled() async {
        settle()
        for _ in 0 ..< Self.turns where (try? coordinator)?.isMeasuring != false {
            try? await Task.sleep(for: .milliseconds(2))
            host.layoutSubtreeIfNeeded()
        }
        settle()
    }

    func settle() {
        for turn in 0 ..< Self.turns {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.002))
            host.layoutSubtreeIfNeeded()
            // `nil` is a deck that has not built its table yet, and `true` a measure still running.
            // Both are waited out; only a table with nothing owed ends the loop, and never before
            // the passes a pane takes to converge.
            guard turn < FeedTableCoordinator.panePasses
                || (try? coordinator)?.isMeasuring != false else { return }
        }
    }

    /// How many turns one settle is given. Far more than the four a layout converges in, because
    /// the measure behind it is somebody else's thread.
    private static let turns = 200

    /// The first view of a kind ON SCREEN under `view`. The deck builds all of these for itself, so
    /// a suite that held one instead would be asserting against a view nothing on screen is.
    ///
    /// Hidden subtrees are skipped, and that is load-bearing rather than tidy: the reader's other
    /// decks stand beside this one inside `FeedDeckStack`, hidden (ADR-0030, Rule 4), and a search
    /// that took the first table it found would answer with whichever deck happens to be first in
    /// the stack's subviews.
    static func find<V: NSView>(_ kind: V.Type, in view: NSView) -> V? {
        guard !view.isHidden else { return nil }
        if let hit = view as? V {
            return hit
        }
        for child in view.subviews {
            if let found = find(kind, in: child) {
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
            readings: FeedScopeFixture.reader(for: reading),
            scope: $scope,
        )
        .environment(\.argoFeedGeometries, geometries)
        .onChange(of: asked.scope, initial: true) { _, asked in scope = asked }
    }
}
