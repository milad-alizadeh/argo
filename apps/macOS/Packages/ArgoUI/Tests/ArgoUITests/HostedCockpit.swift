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

    let host: NSHostingView<AnyView>

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

    /// Read through a MANAGED Session, which is what the app draws for a Session it spawned: the
    /// deck's one slot resolves to a composer and the shell hosts the real `ComposerTextView`
    /// under it, so a pass costed here is a pass of everything a running Session pays for.
    /// `ComposerFieldKeyTests`' `a second hosted composer leaves the first one's field working`
    /// is what keeps that arrangement legitimate (#1000).
    static var presentation: CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [CockpitPresentation.Session(
                id: sessionID,
                title: sessionID,
                access: .managed,
                status: .running,
                transcript: .init(events: TranscriptFixtures.longTranscript),
            )],
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
