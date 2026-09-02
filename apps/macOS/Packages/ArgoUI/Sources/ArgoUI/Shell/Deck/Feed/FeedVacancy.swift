import SwiftUI

/// Why the deck has nothing to read — the four situations a blank feed zone can be in, which one
/// word cannot tell apart.
///
/// Three of the four are facts about the WINDOW rather than about a transcript, which is why the
/// value reaches `FeedSilence` through the environment: the rows cannot carry a claim about the
/// roster beside them.
package enum FeedVacancy: Equatable, Sendable {
    /// A Session is on screen and its reading is empty. The claim `FeedSilence` has always made,
    /// and the default everywhere the fact is not stated.
    case silent
    /// Nothing is on screen, and there are Sessions to put there.
    case unselected
    /// Nothing is on screen because the roster has nothing on it.
    case noSessions
    /// A Session is selected and ARGO has not read it yet — the one state here that is about the
    /// cockpit rather than about the record. DIRECT: it is Argo's own work being reported, and it
    /// says nothing whatever about what the Session is doing.
    ///
    /// The pass that paints a fresh selection takes no reading (`CockpitView.rooms`), so every
    /// switch passes through this state. It normally lasts one frame, which is why the word for it
    /// is held back — see `FeedSilence`.
    ///
    /// Not `FeedAgentReader.unread`, which is a Subagent whose own record has not been fetched.
    /// This one is about the DECK, and about Argo rather than about anything a lane is doing.
    case unread

    /// Which of the four a window is in.
    ///
    /// `hasSelection` is whether a Session RESOLVED, never whether an id is held: a selection
    /// pointing at a Session the roster has dropped draws the same deck as no selection at all,
    /// and it is the deck that is being described here.
    ///
    /// `isDrawn` is asked FIRST, because the reading a window has not taken yet cannot answer
    /// either of the other two: its header is `nil` for the same reason no selection is, and read
    /// as `unselected` a switch would tell the reader to select the row they just clicked.
    package static func reading(
        hasSelection: Bool,
        hasSessions: Bool,
        isDrawn: Bool,
    )
        -> FeedVacancy {
        if !isDrawn {
            return .unread
        }
        if hasSelection {
            return .silent
        }
        return hasSessions ? .unselected : .noSessions
    }

    /// The one line the deck says for it.
    ///
    /// `silent` is a claim about the SURFACE and not about the Session — an agent can be busy in
    /// kinds this feed does not draw yet, so "nothing said" would be a reading of the record.
    ///
    /// `noSessions` may not restate the absence: `SessionNavigator`'s own empty block and the
    /// connection chip both already say there are no Sessions, so a third saying names the DECK
    /// and the way on instead.
    ///
    /// `unread` names ARGO, and that is the whole of the difference between it and `silent`: one
    /// says the record has nothing in it, the other says nobody has looked. Read as `Nothing to
    /// read yet` a switch still resolving would report an empty Session, which is a claim about
    /// the agent that Argo has no grounds for (`CONTEXT.md` · Honesty tier).
    var words: String {
        switch self {
        case .silent: "Nothing to read yet"
        case .unselected: "Select a Session to read it"
        case .noSessions: "Start a Session and its reading appears here"
        case .unread: "Argo has not read this Session yet"
        }
    }

    /// The words a deck in this state says once its wait has run `overdue` — nothing while an
    /// unread deck is still inside `ArgoMotion.unreadDelay`, and the words themselves for the other
    /// three, none of which is a wait at all. `FeedSilence` holds the clock; this is the decision
    /// it makes, where a test can reach it without one.
    func words(overdue: Bool) -> String {
        self == .unread && !overdue ? "" : words
    }

    /// What a titlebar with no Session name announces instead — see `TitlebarTitle`.
    ///
    /// The canopy takes its name off the reading, so a switch leaves it blank until the reading
    /// lands. A blank is a fact withheld and survivable; `No Session selected` spoken over a
    /// Session the reader has just clicked is a false one, which is the misreading `unread` exists
    /// to stop one pane lower.
    package var spokenAbsence: String {
        self == .unread ? words : "No Session selected"
    }
}

package extension EnvironmentValues {
    /// Why the deck below has nothing to read. `silent` where nothing states it, so a specimen or
    /// a preview drawing the feed alone says what it has always said.
    @Entry var argoFeedVacancy: FeedVacancy = .silent
}
