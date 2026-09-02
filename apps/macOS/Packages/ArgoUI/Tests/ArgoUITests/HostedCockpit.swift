import AppKit
import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import SwiftUI

/// The whole shell hosted, so a claim about what ONE pass of its body costs can be made at all.
///
/// Nothing here stands in for anything: `CockpitView` is the shipping view, the navigation is the
/// model the app hands it, and a room is visited by writing the field the Navigate menu writes.
/// That is the whole point of it. Two of the four gaps #997 found were unheld for one reason —
/// every fixture drove the values BELOW the shell and reimplemented the shell's own wiring on the
/// way down, so replacing that wiring with the defect left all of them green.
///
/// No window and no run loop. A hosting view evaluates the body it is asked to lay out, which is
/// all these claims need; and a nested `RunLoop.run` inside a `@MainActor` test lets other tests
/// run re-entrantly, which over a static counter is a flake nobody would trace back to here.
@MainActor final class HostedCockpit {
    let navigation = CockpitNavigationModel()

    let host: NSHostingView<AnyView>

    /// Opened in the Sessions room on a Session with a real transcript in it — the one room that
    /// takes a reading at all.
    convenience init() {
        self.init(showing: Self.presentation)
    }

    /// The same shell over a roster the caller assembled, so a claim about SWITCHING between
    /// Sessions has two of them to switch between.
    init(showing presentation: CockpitPresentation) {
        navigation.room = .sessions
        navigation.session = presentation.sessions.first?.id
        self.host = NSHostingView(rootView: AnyView(
            CockpitView(presentation: presentation, actions: .inert)
                .environment(navigation),
        ))
        host.frame = NSRect(x: 0, y: 0, width: 1200, height: 800)
        host.layoutSubtreeIfNeeded()
    }

    /// One room picked and the shell laid out again — a pass of `CockpitView.body`, and on the way
    /// back into the Sessions room a fresh mount of everything the deck's room `switch` destroys.
    func visit(_ room: CockpitRoom) {
        navigation.room = room
        host.layoutSubtreeIfNeeded()
    }

    /// The turns AFTER the click: whatever `DrawnSession` enqueued, drained, and the shell laid
    /// out again. What the reader sees a beat later, and the only way a suite with no run loop
    /// under it reaches the deferred half of a switch.
    func settle() async {
        for _ in 0 ..< Self.turns {
            await Task.yield()
            host.layoutSubtreeIfNeeded()
        }
    }

    /// `settle()`'s passes WITHOUT its yields — the same view-graph warm-up and none of the
    /// draining. It exists so a figure's two arms can be alike: a shell measured against a settled
    /// one would otherwise be measured against four extra layout passes as well as against the
    /// deferral. See `SessionSelectionFigureRecording`.
    func warm() {
        for _ in 0 ..< Self.turns {
            host.layoutSubtreeIfNeeded()
        }
    }

    /// Enough turns for a `Task` enqueued during an update to have run. Four rather than one
    /// because the catch-up invalidates the body, and what it invalidates is laid out on the next.
    private static let turns = 4

    /// One row picked and the shell laid out again — the pass between the mouse-down and the
    /// frame that paints the new selection, which is the whole of what `SessionSelectionCostTests`
    /// measures.
    func select(_ sessionID: CockpitPresentation.Session.ID) {
        navigation.session = sessionID
        host.layoutSubtreeIfNeeded()
    }

    /// A roster of `ids`, each carrying `events`. What a switch costs is per Session, so a fixture
    /// with one row in it could not be switched at all.
    ///
    /// Every row is MANAGED and running, which is what the app draws for a Session it spawned: the
    /// deck's one slot resolves to a composer and the shell hosts the real `ComposerTextView`
    /// under it, so a pass costed here is a pass of everything a running Session pays for.
    /// `ComposerFieldKeyTests`' `a second hosted composer leaves the first one's field working`
    /// is what keeps that arrangement legitimate (#1000).
    static func presentation(
        of ids: [CockpitPresentation.Session.ID],
        events: [TranscriptEvent],
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: ids.map { id in
                CockpitPresentation.Session(
                    id: id,
                    title: id,
                    access: .managed,
                    status: .running,
                    transcript: .init(events: events),
                )
            },
            checkout: .unavailable,
            connection: .idle,
        )
    }

    private static let sessionID = "one"

    /// One Session, read through the roster builder above rather than beside it: two builders of
    /// the same value are two places for a fixture to drift.
    static var presentation: CockpitPresentation {
        presentation(of: [sessionID], events: TranscriptFixtures.longTranscript)
    }
}
