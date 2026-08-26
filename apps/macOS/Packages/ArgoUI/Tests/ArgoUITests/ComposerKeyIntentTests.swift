import AppKit
@testable import ArgoUI
import Testing

/// What a keystroke at the composer means, decided away from the text view that receives it (#734).
///
/// The whole reason the field is now an `NSTextView`: Return has to submit and Shift-Return has to
/// break the line, and an `NSTextField` gives no caret to break it at. The rule is asserted here
/// rather than through the control, because a key that resolves wrong is a Turn sent mid-sentence.
@Suite("Composer keystrokes")
struct ComposerKeyIntentTests {
    private static func intent(
        _ code: UInt16,
        _ modifiers: NSEvent.ModifierFlags = [],
    )
        -> ComposerKeyIntent {
        ComposerKeyIntent.intent(forKeyCode: code, modifiers: modifiers)
    }

    @Test
    func `a bare Return sends the Turn`() {
        #expect(Self.intent(ComposerKeyIntent.returnKey) == .submit)
        #expect(Self.intent(ComposerKeyIntent.keypadEnterKey) == .submit)
    }

    /// The complaint the ticket opens with.
    @Test
    func `shift held with Return breaks the line instead of sending`() {
        #expect(Self.intent(ComposerKeyIntent.returnKey, .shift) == .newline)
    }

    /// The platform's own second line, which the stock field already gave and must keep giving.
    @Test
    func `the platform's Option-Return breaks the line too`() {
        #expect(Self.intent(ComposerKeyIntent.returnKey, .option) == .newline)
    }

    /// A held Command or Control is somebody reaching for a shortcut, not for either meaning of
    /// Return — so it goes past the field rather than sending a half-typed Turn.
    @Test
    func `a Return under a shortcut modifier is not the field's to answer`() {
        #expect(Self.intent(ComposerKeyIntent.returnKey, .command) == .pass)
        #expect(Self.intent(ComposerKeyIntent.returnKey, .control) == .pass)
    }

    /// The arrows are the menus' before they are the caret's, and only unmodified: Option-arrow is
    /// a word jump and Shift-arrow is a selection, both of which belong to the text.
    @Test
    func `the bare arrows are offered to whichever menu is open`() {
        #expect(Self.intent(ComposerKeyIntent.downArrowKey) == .walkDown)
        #expect(Self.intent(ComposerKeyIntent.upArrowKey) == .walkUp)
        #expect(Self.intent(ComposerKeyIntent.downArrowKey, .option) == .pass)
        #expect(Self.intent(ComposerKeyIntent.upArrowKey, .shift) == .pass)
    }

    /// The keypad flags ride along on every arrow press, so the mask has to ignore them or no arrow
    /// ever reaches a menu.
    @Test
    func `an arrow still walks with the keypad flags the platform attaches`() {
        #expect(Self.intent(ComposerKeyIntent.downArrowKey, [.function, .numericPad]) == .walkDown)
    }

    @Test
    func `escape puts an open menu away`() {
        #expect(Self.intent(ComposerKeyIntent.escapeKey) == .dismiss)
    }

    /// `a` on a US layout, standing for every key that is not one of the five above.
    private static let letterKey: UInt16 = 0

    @Test
    func `every other key is the text's`() {
        #expect(Self.intent(Self.letterKey) == .pass)
    }
}
