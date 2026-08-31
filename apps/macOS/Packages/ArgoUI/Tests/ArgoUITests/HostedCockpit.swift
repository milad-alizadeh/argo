import AppKit
import ArgoEngine
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

    private let host: NSHostingView<AnyView>

    /// Opened in the Sessions room on a Session with a real transcript in it — the one room that
    /// takes a reading at all.
    init() {
        navigation.room = .sessions
        navigation.session = Self.sessionID
        self.host = NSHostingView(rootView: AnyView(
            CockpitView(presentation: Self.presentation, actions: .inert)
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

    private static let sessionID = "one"

    /// Read through an EXTERNAL Session, which is the one thing here chosen against the app rather
    /// than after it. A managed one puts a composer in the deck's vessel, and a second hosted
    /// `ComposerTextView` in the process stops the first one's draft being written back into its
    /// text view at all — `ComposerFieldKeyTests` then waits out its whole settle limit, 3 full
    /// runs in 5. Neither claim below is about the vessel: both are about the reading the pass
    /// takes and the store its table is bound to, and an external Session takes the same reading.
    private static var presentation: CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [CockpitPresentation.Session(
                id: sessionID,
                title: sessionID,
                access: .external,
                status: .running,
                transcript: .init(events: TranscriptFixtures.longTranscript),
            )],
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
