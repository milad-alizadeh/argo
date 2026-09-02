import SwiftUI

/// Why the deck has nothing to read — the three situations a blank feed zone can be in, which one
/// word cannot tell apart.
///
/// A window with Sessions and none chosen is not a window with no Sessions in it, and neither is a
/// chosen Session that has said nothing. Drawn alike they read as one thing, and the one they read
/// as is the most broken of the three (#404 AC1).
///
/// Two of the three are facts about the WINDOW rather than about a transcript, which is why the
/// value reaches `FeedSilence` through the environment: the rows cannot carry a claim about the
/// roster beside them.
enum FeedVacancy: Equatable, Sendable {
    /// A Session is on screen and its reading is empty. The claim `FeedSilence` has always made,
    /// and the default everywhere the fact is not stated.
    case silent
    /// Nothing is on screen, and there are Sessions to put there.
    case unselected
    /// Nothing is on screen because the roster has nothing on it.
    case noSessions

    /// Which of the three a window is in.
    ///
    /// `hasSelection` is whether a Session RESOLVED, never whether an id is held: a selection
    /// pointing at a Session the roster has dropped draws the same deck as no selection at all,
    /// and it is the deck that is being described here.
    static func reading(hasSelection: Bool, hasSessions: Bool) -> FeedVacancy {
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
    /// `noSessions` names the DECK and the way on rather than restating the absence: an empty
    /// window already says "No Sessions yet" in the roster's own block, and it said it a third time
    /// in the connection chip — three statements of one fact, which is what the render of this
    /// state caught (#404). `unselected` is the one word in its window doing any work, which is why
    /// it is the one that points at the rail.
    var words: String {
        switch self {
        case .silent: "Nothing to read yet"
        case .unselected: "Select a Session to read it"
        case .noSessions: "Start a Session and its reading appears here"
        }
    }
}

extension EnvironmentValues {
    /// Why the deck below has nothing to read. `silent` where nothing states it, so a specimen or
    /// a preview drawing the feed alone says what it has always said.
    @Entry var argoFeedVacancy: FeedVacancy = .silent
}
