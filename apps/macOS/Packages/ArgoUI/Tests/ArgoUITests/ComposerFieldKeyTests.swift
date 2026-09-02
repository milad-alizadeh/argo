import AppKit
@testable import ArgoUI
import Testing

/// The composer's field with keys actually pressed at it (#734).
///
/// A hosted view and a synthesized event, because the claim is about the seam between AppKit and
/// the draft: `ComposerKeyIntentTests` proves what a keystroke MEANS, and nothing there proves the
/// meaning is carried out. The e2e case over the same two keys costs a launch of the whole app;
/// this costs a layout pass.
///
/// The rig itself — the hosted composer, the synthesized Return, and the wait for SwiftUI's
/// write-back — is `ComposerFieldHost`.
@Suite("Composer field keys")
@MainActor struct ComposerFieldKeyTests {
    @Test
    func `shift held with Return breaks the line and the draft holds both`() throws {
        let field = try ComposerFieldHost.hosted()

        field.input.insertText("first", replacementRange: field.input.selectedRange())
        field.press(.shift)
        field.input.insertText("second", replacementRange: field.input.selectedRange())
        field.settle { field.input.string == "first\nsecond" }

        #expect(field.input.string == "first\nsecond")
        #expect(field.draft.text == "first\nsecond")
    }

    @Test
    func `a bare Return sends the Turn and empties the field`() throws {
        let field = try ComposerFieldHost.hosted()

        field.input.insertText("send me", replacementRange: field.input.selectedRange())
        #expect(field.draft.text == "send me")

        field.press([])
        field.settle { field.input.string.isEmpty }

        #expect(field.sent == ["send me"])
        #expect(field.draft.text.isEmpty)
        #expect(field.input.string.isEmpty)
    }

    /// The clear after a send reaches the field on every Turn, not only the first (#1000).
    ///
    /// Five Turns rather than two because the first one is the one that always worked: a send
    /// leaves the field stale only once something has already rendered at that value, so the
    /// staleness — and the line it concatenates onto the next Turn — begins at the second.
    @Test
    func `every Turn sent empties the field, not only the first`() throws {
        let field = try ComposerFieldHost.hosted()

        for turn in 1 ... 5 {
            field.input.insertText("turn \(turn)", replacementRange: field.input.selectedRange())
            field.press([])
            field.settle { field.input.string.isEmpty }
            #expect(field.input.string.isEmpty)
        }

        #expect(field.sent == (1 ... 5).map { "turn \($0)" })
    }

    /// The field grew onto a second line and has to come back off it: the clear a send leaves
    /// arrives without a SwiftUI pass of its own, and a field emptied at two lines' height would
    /// hold a gap over the feed until some later layout happened to close it (#1000).
    @Test
    func `a multi-line draft sent takes the field back to one line`() throws {
        let field = try ComposerFieldHost.hosted()

        let atRest = field.height

        field.input.insertText("first", replacementRange: field.input.selectedRange())
        field.press(.shift)
        field.input.insertText("second", replacementRange: field.input.selectedRange())
        field.settle { field.height > atRest }
        #expect(field.height > atRest)

        field.press([])
        field.settle { field.input.string.isEmpty }

        #expect(field.height == atRest)
    }

    /// Two composers hosted at once, which IS a legitimate arrangement — the app draws one per
    /// cockpit window, and `ComposerField`'s own preview draws three (#1000).
    @Test
    func `a second hosted composer leaves the first one's field working`() throws {
        let first = try ComposerFieldHost.hosted()
        let second = try ComposerFieldHost.hosted()

        second.input.insertText("theirs", replacementRange: second.input.selectedRange())
        second.press([])
        second.settle { second.input.string.isEmpty }

        first.input.insertText("mine", replacementRange: first.input.selectedRange())
        first.press([])
        first.settle { first.input.string.isEmpty }

        #expect(first.input.string.isEmpty)
        #expect(first.sent == ["mine"])
        #expect(second.sent == ["theirs"])
    }
}
