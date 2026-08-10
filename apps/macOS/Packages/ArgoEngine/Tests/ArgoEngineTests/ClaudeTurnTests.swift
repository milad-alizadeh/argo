@testable import ArgoEngine
import Testing

/// The wire contract between the composer and a `claude` nobody is looking at.
///
/// These assert the exact bytes because the bytes ARE the claim: the TUI on the other end is a
/// real terminal program, and "one Turn, multi-line included" is a statement about what it reads
/// off the descriptor rather than about anything Argo holds.
@Suite("Claude turn")
struct ClaudeTurnTests {
    @Test
    func `a multi-line Turn is pasted whole rather than typed line by line`() {
        let keys = ClaudeTurn.keystrokes(for: "Fix the caption.\nThe sort is right.")

        #expect(keys == "\u{1B}[200~Fix the caption.\nThe sort is right.\u{1B}[201~\r")
    }

    @Test
    func `a one-line Turn is submitted the same way as a long one`() {
        let keys = ClaudeTurn.keystrokes(for: "Run the suite")

        #expect(keys == "\u{1B}[200~Run the suite\u{1B}[201~\r")
    }

    /// A line ending pasted from anywhere but a Unix editor arrives as CRLF, and a PTY reads CR as
    /// Return — so passing one through would submit the Turn at the first line break and leave the
    /// rest of the paragraph to be answered as a second Turn.
    @Test
    func `a Windows line ending does not submit the Turn at the first line`() {
        let keys = ClaudeTurn.keystrokes(for: "first\r\nsecond\rthird")

        #expect(keys == "\u{1B}[200~first\nsecond\nthird\u{1B}[201~\r")
    }

    /// The paste is a bracket, and anything that can write the closing bracket can close it early
    /// — after which the remainder of the message is read as keystrokes, not as text. Transcript
    /// prose quoted back into the composer is enough to do it by accident.
    @Test
    func `text carrying the paste terminator cannot end its own paste`() {
        let keys = ClaudeTurn.keystrokes(for: "before\u{1B}[201~after")

        #expect(keys == "\u{1B}[200~beforeafter\u{1B}[201~\r")
    }

    @Test
    func `text carrying the paste opener cannot open a second paste`() {
        let keys = ClaudeTurn.keystrokes(for: "before\u{1B}[200~after")

        #expect(keys == "\u{1B}[200~beforeafter\u{1B}[201~\r")
    }

    /// Deleting a marker splices its neighbours together, and the right fragments either side of
    /// one marker assemble into the OTHER — a fresh opener standing in output the single pass had
    /// already sanitised. Removal has to run to a fixed point or it is not removal.
    @Test
    func `fragments spliced by a removal cannot assemble a fresh marker`() {
        let keys = ClaudeTurn.keystrokes(for: "\u{1B}[20\u{1B}[201~0~payload")

        #expect(keys == "\u{1B}[200~payload\u{1B}[201~\r")
    }

    /// The other direction of the same splice: a CR split by a marker must not survive as a raw
    /// Return once the marker between its halves is removed.
    @Test
    func `a line ending split by a marker does not survive as a Return`() {
        let keys = ClaudeTurn.keystrokes(for: "first\r\u{1B}[201~\nsecond")

        #expect(keys == "\u{1B}[200~first\nsecond\u{1B}[201~\r")
    }
}
