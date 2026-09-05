@testable import ArgoUI
import Testing

/// What a click, a shift-click and a cmd-click do to a list's selection (#1247).
///
/// One suite for both lists: the roster and the backlog share this value, so a rule proved here
/// is proved for the two surfaces at once.
@Suite("A list's range selection")
struct RowSelectionTests {
    private let visible = ["a", "b", "c", "d", "e"]

    @Test
    func `a click selects one row and sets the anchor`() {
        var selection = RowSelection<String>()

        selection.click("c")

        #expect(selection.rows == ["c"])
        #expect(selection.anchor == "c")
        #expect(selection.last == "c")
    }

    @Test
    func `a shift-click selects every row from the anchor to it`() {
        var selection = RowSelection<String>()
        selection.click("b")

        selection.extend(to: "d", over: visible)

        #expect(selection.rows == ["b", "c", "d"])
    }

    @Test
    func `a shift-click reaches backwards from the anchor just as far`() {
        var selection = RowSelection<String>()
        selection.click("d")

        selection.extend(to: "b", over: visible)

        #expect(selection.rows == ["b", "c", "d"])
    }

    @Test
    func `a second shift-click moves the far end and leaves the anchor`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "e", over: visible)

        selection.extend(to: "c", over: visible)

        #expect(selection.rows == ["b", "c"])
        #expect(selection.anchor == "b")
    }

    /// A shift-click before anything was clicked has no far end to grow from, so it is the click
    /// the reader has not made yet.
    @Test
    func `a shift-click with no anchor selects the one row`() {
        var selection = RowSelection<String>()

        selection.extend(to: "d", over: visible)

        #expect(selection.rows == ["d"])
        #expect(selection.anchor == "d")
    }

    /// The range is taken over the rows the list is DRAWING, so a row behind a shut fold is not
    /// in the array and cannot be pulled into the selection.
    @Test
    func `a shift-click never reaches a row behind a shut fold`() {
        var selection = RowSelection<String>()
        selection.click("a")

        selection.extend(to: "e", over: ["a", "e"])

        #expect(selection.rows == ["a", "e"])
    }

    @Test
    func `a cmd-click adds one row and makes it the anchor`() {
        var selection = RowSelection<String>()
        selection.click("b")

        selection.toggle("d")

        #expect(selection.rows == ["b", "d"])
        #expect(selection.anchor == "d")
        #expect(selection.last == "d")
    }

    @Test
    func `a cmd-click on a selected row removes it and leaves the rest`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        selection.toggle("c", over: visible)

        #expect(selection.rows == ["b", "d"])
        #expect(selection.anchor == "c")
    }

    /// The deck draws the last row that was clicked, and a row just taken out of the selection is
    /// not one. Taking the LAST row out leaves nothing to draw.
    @Test
    func `a cmd-click that empties the selection leaves the deck on nothing`() {
        var selection = RowSelection<String>()
        selection.click("b")

        selection.toggle("b", over: visible)

        #expect(selection.rows.isEmpty)
        #expect(selection.last == nil)
    }

    /// Taking the drawn row out of a RANGE moves the deck to what is left rather than closing it:
    /// the reader asked for one row less, not for the surface beside the list to go blank.
    @Test
    func `a cmd-click off the drawn row moves the deck to what is left`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        selection.toggle("b", over: visible)

        #expect(selection.rows == ["c", "d"])
        #expect(selection.last == "c")
    }

    /// Growing a selection is not a second act of opening a row: the deck stays on the one click
    /// that named it.
    @Test
    func `growing the selection past one row moves the deck no further`() {
        var selection = RowSelection<String>()
        selection.click("b")

        selection.extend(to: "d", over: visible)

        #expect(selection.last == "b")
    }

    @Test
    func `a right-click inside the selection leaves it whole`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        #expect(selection.aim(at: "c") == ["b", "c", "d"])
    }

    @Test
    func `a right-click outside the selection acts on that row alone`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        #expect(selection.aim(at: "e") == ["e"])
    }

    /// A row the list has stopped drawing — folded away, archived, gone — is not selected any
    /// more, or the menu would act on a Session nobody can see.
    @Test
    func `confining to the drawn rows drops the ones that left`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        selection.confine(to: ["a", "b"])

        #expect(selection.rows == ["b"])
        #expect(selection.anchor == "b")
    }

    /// Another surface pointing the window at a row is one click's worth of selection, not an
    /// addition to what the reader had built (#1273).
    @Test
    func `pointing the list at a row from outside replaces the selection`() {
        var selection = RowSelection<String>()
        selection.click("b")
        selection.extend(to: "d", over: visible)

        selection.point(at: "e")

        #expect(selection.rows == ["e"])
        #expect(selection.last == "e")
    }

    @Test
    func `pointing the list at nothing empties it`() {
        var selection = RowSelection<String>()
        selection.click("b")

        selection.point(at: nil)

        #expect(selection.rows.isEmpty)
        #expect(selection.anchor == nil)
        #expect(selection.last == nil)
    }
}
