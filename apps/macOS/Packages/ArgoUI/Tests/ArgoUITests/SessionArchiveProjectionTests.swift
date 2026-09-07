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

    /// A mid-turn Session is asked about whether or not Argo owns it (#1596). Ownership decides
    /// what the prompt SAYS; it never decides whether one is raised. Either the archive ends live
    /// work or it takes a working agent off the roster and leaves it running, and both are things
    /// the reader has to answer for.
    ///
    /// `starting` is asked about too: Argo has just launched that process and has not heard it
    /// yet, which is the one state where live work is DIRECT rather than read.
    @Test
    func `archiving a Session mid-turn is confirmed whoever owns it`() {
        for status in [SessionStatus.starting, .running, .permission, .asking] {
            #expect(SessionArchiveProjection.confirms(status: status, archiving: true))
        }
    }

    /// A Session that is not mid-turn is archived on the gesture, with nothing in the way: the
    /// agent is between Turns, and a prompt on every archive is a prompt nobody reads.
    @Test
    func `archiving a Session between Turns is not confirmed`() {
        for status in [SessionStatus.idle, .stopped, .ended, .unknown] {
            #expect(!SessionArchiveProjection.confirms(status: status, archiving: true))
        }
    }

    /// Putting a Session back starts nothing, so it is never confirmed however it reads.
    @Test
    func `putting a Session back is never confirmed`() {
        for status in SessionStatus.allCases {
            #expect(!SessionArchiveProjection.confirms(status: status, archiving: false))
        }
    }

    /// The prompt names the Session being ended rather than asking about "this session": the
    /// gesture is reachable from the menu bar, where the row it acts on may not be in view.
    @Test
    func `the prompt names the Session and says what ending it does`() {
        #expect(SessionArchiveProjection.confirmTitle(names: ["Rebuild the roster"])
            == "Archive \u{201C}Rebuild the roster\u{201D}?")
        // The message is not re-typed here to be compared with itself: an assertion that can only
        // fail when somebody edits the copy is a change detector, and it would be edited in both
        // places. What is asserted is what the words have to DO — say that ending is not losing,
        // which is the sentence a reader needs before they dare archive a Session mid-turn.
        let ends = SessionArchiveProjection.confirmMessage(ending: 1, staying: 0)
        #expect(ends.contains("ends that agent"))
        #expect(ends.contains("keeps the history"))
        // The verb says both halves. "Archive" alone reads as the gesture that only hid the row.
        #expect(SessionArchiveProjection.confirmVerb(ending: 1).contains("Archive"))
        #expect(SessionArchiveProjection.confirmVerb(ending: 1).contains("End"))
    }

    /// A batch is counted rather than listed: four names in a title is a title nobody reads, and
    /// the plural message has to say the same thing about ending agents that the singular does.
    @Test
    func `a batch prompt counts the Sessions and speaks of them in the plural`() {
        #expect(SessionArchiveProjection.confirmTitle(names: ["one", "two", "three"])
            == "Archive 3 Sessions?")
        let ends = SessionArchiveProjection.confirmMessage(ending: 3, staying: 0)
        #expect(ends.contains("ends those agents"))
        #expect(ends.contains("keeps the history"))
    }

    /// The failure #1596 is about, said out loud. Argo holds no claim on this Session, so the
    /// archive takes the row off the roster and the agent works on. The reader has to be told
    /// that BEFORE they press, because nothing on screen says it afterwards.
    @Test
    func `a prompt over an agent Argo cannot end says the agent keeps running`() {
        let outlives = SessionArchiveProjection.confirmMessage(ending: 0, staying: 1)
        #expect(outlives.contains("cannot end"))
        #expect(outlives.contains("keeps running"))
        // And the promise the owned copy makes must not be made here: nothing is ended.
        #expect(!outlives.contains("ends that agent"))
    }

    /// The plural of the same, asserted separately because they are two strings — and a rule that
    /// covered one set and not the other is the whole of what #1596 is.
    @Test
    func `a batch Argo cannot end speaks of the agents in the plural`() {
        let outlives = SessionArchiveProjection.confirmMessage(ending: 0, staying: 3)
        #expect(outlives.contains("cannot end"))
        #expect(outlives.contains("keep running"))
    }

    /// A roster holds Sessions this window started beside ones an earlier run did, so a batch is
    /// rarely all one thing. Both halves are counted: a reader told only the total cannot tell
    /// which agents survive the gesture.
    @Test
    func `a mixed batch says how many end and how many keep running`() {
        let mixed = SessionArchiveProjection.confirmMessage(ending: 2, staying: 3)
        #expect(mixed.contains("2"))
        #expect(mixed.contains("3"))
        #expect(mixed.contains("keep running"))
    }

    /// The verb turns around with the message. "Archive and End" over a batch nothing will end is
    /// the button lying about what pressing it does; over a mixed one, some do end, so it stands.
    @Test
    func `the verb stops promising an end where there is none`() {
        #expect(!SessionArchiveProjection.confirmVerb(ending: 0).contains("End"))
        #expect(SessionArchiveProjection.confirmVerb(ending: 0).contains("Archive"))
        #expect(SessionArchiveProjection.confirmVerb(ending: 2).contains("End"))
    }

    /// The menu carries no rows to point at, so it says how many it covers (#1247). One row keeps
    /// the singular the menu bar already uses.
    @Test
    func `the menu counts what a multi-row selection archives`() {
        #expect(SessionArchiveProjection.menuTitle(isArchived: false, count: 4)
            == "Archive 4 Sessions")
        #expect(SessionArchiveProjection.menuTitle(isArchived: true, count: 4)
            == "Put 4 Sessions Back on the Roster")
        #expect(SessionArchiveProjection.menuTitle(isArchived: false, count: 1)
            == SessionArchiveProjection.menuTitle(isArchived: false))
        #expect(SessionArchiveProjection.menuTitle(isArchived: true, count: 1)
            == SessionArchiveProjection.menuTitle(isArchived: true))
    }
}
