import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// One gesture, two readings of it. The menu bar and the Roster row reached it through two
/// literals that had already drifted apart in case (#800), so both are asserted here — and they
/// now say deliberately different words, which is exactly why neither may drift again (#1257).
struct SessionArchiveProjectionTests {
    @Test
    func `archiving and putting back are Title Case, as menu items are`() {
        #expect(SessionArchiveProjection.menuTitle(isArchived: false) == "Archive Session")
        #expect(SessionArchiveProjection.menuTitle(isArchived: true) == "Put Back on the Roster")
    }

    @Test
    func `the row names the verb without naming what it acts on`() {
        #expect(SessionArchiveProjection.rowTitle(isArchived: false) == "Archive")
        #expect(SessionArchiveProjection.rowTitle(isArchived: true) == "Put Back")
    }

    /// The item is disabled with nothing selected, but still drawn — a menu with a blank line in it
    /// reads as broken rather than as inactive.
    @Test
    func `the disabled item reads as the gesture it would perform`() {
        #expect(SessionArchiveProjection.fallbackTitle == "Archive Session")
    }

    @Test
    func `the symbol turns around with the verb`() {
        #expect(SessionArchiveProjection.symbol(isArchived: false) == ArgoSymbol.archive)
        #expect(SessionArchiveProjection.symbol(isArchived: true) == ArgoSymbol.unarchive)
    }

    /// Archiving a Session Argo owns ends its agent, so the reader is asked first while that agent
    /// is mid-turn (#1290). `starting` is asked about too: Argo has just launched that process and
    /// has not heard it yet, which is the one state where it certainly owns live work.
    @Test
    func `archiving a managed Session mid-turn is confirmed`() {
        for status in [SessionStatus.starting, .running, .permission, .asking] {
            #expect(SessionArchiveProjection.confirms(access: .managed, status: status))
        }
    }

    /// A Session that is not mid-turn is archived on the gesture, with nothing in the way: the
    /// agent is between Turns, and a prompt on every archive is a prompt nobody reads.
    @Test
    func `archiving a managed Session between Turns is not confirmed`() {
        for status in [SessionStatus.idle, .stopped, .ended, .unknown] {
            #expect(!SessionArchiveProjection.confirms(access: .managed, status: status))
        }
    }

    /// Nothing is ended, so there is nothing to ask about. An external Session reads `running` off
    /// its own transcript, and Argo has no channel to it either way.
    @Test
    func `archiving a Session Argo does not own is never confirmed`() {
        for access in [CockpitPresentation.Session.Access.external, .orphaned] {
            for status in SessionStatus.allCases {
                #expect(!SessionArchiveProjection.confirms(access: access, status: status))
            }
        }
    }

    /// Putting a Session back starts nothing, so it is never confirmed however it reads.
    @Test
    func `putting a Session back is never confirmed`() {
        #expect(!SessionArchiveProjection.confirms(
            access: .managed,
            status: .running,
            archiving: false,
        ))
    }

    /// The prompt names the Session being ended rather than asking about "this session": the
    /// gesture is reachable from the menu bar, where the row it acts on may not be in view.
    @Test
    func `the prompt names the Session and says what ending it does`() {
        #expect(SessionArchiveProjection.confirmTitle(name: "Rebuild the roster")
            == "Archive \u{201C}Rebuild the roster\u{201D}?")
        #expect(SessionArchiveProjection.confirmMessage == """
        Its agent is working. Archiving ends that agent and takes the Session off the roster. \
        Putting it back keeps the history, and it can be continued from there.
        """)
        #expect(SessionArchiveProjection.confirmVerb == "Archive and End")
    }
}
