@testable import ArgoUI
import Testing

/// Every rule the swipe has, asserted where it is decided rather than where it is drawn: a
/// gesture whose thresholds lived in a `DragGesture` closure would be checkable only by hand.
@Suite("Roster swipe")
struct RosterSwipeTests {
    /// A pull that clearly started but stopped short of the control. The row springs the rest of
    /// the way rather than punishing it.
    @Test
    func `a row pulled past the settle distance stays open when it is let go`() {
        var swipe = RosterSwipe()

        swipe.drag("a", translation: -ArgoLayout.rosterSwipeSettle)

        #expect(swipe.release("a") == .open)
        #expect(swipe.openRowID == "a")
        #expect(swipe.offset(of: "a") == -ArgoLayout.rosterSwipeRevealWidth)
    }

    @Test
    func `a row barely moved snaps back and reveals nothing`() {
        var swipe = RosterSwipe()

        swipe.drag("a", translation: -(ArgoLayout.rosterSwipeSettle - 1))

        #expect(swipe.release("a") == .closed)
        #expect(swipe.openRowID == nil)
        #expect(swipe.isRevealing("a") == false)
    }

    /// The hard swipe: clearing several Sessions must not cost two gestures each (story 12).
    @Test
    func `a row pulled past the commit distance archives on release`() {
        var swipe = RosterSwipe()

        swipe.drag("a", translation: -ArgoLayout.rosterSwipeCommit)

        #expect(swipe.release("a") == .archive)
        // Nothing is left open behind an archive: the row it belonged to is gone from the list.
        #expect(swipe.openRowID == nil)
    }

    @Test
    func `a row follows the finger only as far as the hard swipe`() {
        var swipe = RosterSwipe()

        swipe.drag("a", translation: -(ArgoLayout.rosterSwipeCommit * 4))

        // Past the point where releasing archives, further travel says nothing — and a row that
        // kept sliding would read as one that could be pulled clean off the roster.
        #expect(swipe.offset(of: "a") == -ArgoLayout.rosterSwipeCommit)
    }

    @Test
    func `a row at rest is not drawn off its place and reveals nothing`() {
        let swipe = RosterSwipe()

        #expect(swipe.offset(of: "a") == 0)
        // No chrome at rest is the whole bargain of putting the verb behind a gesture.
        #expect(swipe.isRevealing("a") == false)
    }

    @Test
    func `pulling one row closes the row that was already open`() {
        var swipe = RosterSwipe()
        swipe.drag("a", translation: -ArgoLayout.rosterSwipeSettle)
        _ = swipe.release("a")

        swipe.drag("b", translation: -ArgoLayout.rosterSwipeSettle)

        // At the moment the second pull starts, not when it ends: a half-open row left behind
        // the reader is only noticed once they have moved on (story 13).
        #expect(swipe.isRevealing("a") == false)
        #expect(swipe.isRevealing("b"))
        #expect(swipe.release("b") == .open)
        #expect(swipe.openRowID == "b")
    }

    @Test
    func `a pull on any other row closes the open one, however short it turns out to be`() {
        var swipe = RosterSwipe()
        swipe.drag("a", translation: -ArgoLayout.rosterSwipeSettle)
        _ = swipe.release("a")

        swipe.drag("b", translation: -1)
        _ = swipe.release("b")

        // Still only one row open — and it is not `a`, which the pull on `b` closed. The list
        // never holds two.
        #expect(swipe.openRowID == nil)
    }

    @Test
    func `an open row pushed back the way it came closes`() {
        var swipe = RosterSwipe()
        swipe.drag("a", translation: -ArgoLayout.rosterSwipeSettle)
        _ = swipe.release("a")

        // The gesture measures from where the row is sitting, so a push right unwinds it rather
        // than opening it further.
        swipe.drag("a", translation: ArgoLayout.rosterSwipeRevealWidth)

        #expect(swipe.offset(of: "a") == 0)
        #expect(swipe.release("a") == .closed)
    }

    @Test
    func `an open row is dragged on from where it sits, not from the edge of the roster`() {
        var swipe = RosterSwipe()
        swipe.drag("a", translation: -ArgoLayout.rosterSwipeSettle)
        _ = swipe.release("a")

        swipe.drag("a", translation: -ArgoSpacing.snug)

        // Further left than the control alone: the pull ADDED to where the row was already
        // sitting rather than restarting it from the roster's edge — which would make an open
        // row harder to archive than a closed one, by exactly the reveal.
        #expect(swipe.offset(of: "a") < -ArgoLayout.rosterSwipeRevealWidth)
        #expect(swipe.offset(of: "a") > -ArgoLayout.rosterSwipeCommit)
    }

    @Test
    func `closing shuts everything, whatever was open`() {
        var swipe = RosterSwipe(openRowID: "a")

        swipe.close()

        // What clicking elsewhere and moving the selection both mean.
        #expect(swipe.openRowID == nil)
        #expect(swipe.isRevealing("a") == false)
    }

    /// The three distances are one ordered scale, and the order is what makes the two gestures
    /// distinguishable: a commit reachable by a pull that meant to stop at the control would
    /// archive Sessions nobody asked to archive.
    @Test
    func `the settle is short of the control and the commit is well past it`() {
        #expect(ArgoLayout.rosterSwipeSettle < ArgoLayout.rosterSwipeRevealWidth)
        #expect(ArgoLayout.rosterSwipeRevealWidth < ArgoLayout.rosterSwipeCommit)
    }
}
