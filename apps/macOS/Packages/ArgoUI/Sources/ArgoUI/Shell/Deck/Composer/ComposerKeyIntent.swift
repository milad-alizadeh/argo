import AppKit

/// What a keystroke at the composer means, decided before the text view acts on it (#734).
///
/// A rule rather than a set of key bindings: the field is an `NSTextView` now, and its own bindings
/// answer Return and Shift-Return the same way — `insertNewline:` for both. Deciding here is also
/// what makes the answer assertable without a control to press keys at.
enum ComposerKeyIntent: Equatable {
    /// Send the Turn, or take the row under an open menu's cursor — `SessionComposer.submit` picks.
    case submit
    /// Break the line at the caret, which is the whole reason the control was replaced.
    case newline
    /// Offered to whichever menu is open; the caret keeps it where there is none.
    case walkDown
    case walkUp
    /// Put an open menu away, leaving the draft as it was.
    case dismiss
    /// Not the field's to answer.
    case pass

    // The keys by their virtual codes, which are layout-independent where `characters` is not: a
    // Dvorak or an AZERTY layout moves every letter and none of these.
    static let returnKey: UInt16 = 36
    static let keypadEnterKey: UInt16 = 76
    static let escapeKey: UInt16 = 53
    static let downArrowKey: UInt16 = 125
    static let upArrowKey: UInt16 = 126

    /// The modifiers that change what a key MEANS here. The keypad and function flags ride along on
    /// every arrow press and say nothing about intent, so they are masked out rather than tested.
    private static let meaningful: NSEvent.ModifierFlags = [.shift, .option, .command, .control]

    static func intent(forKeyCode code: UInt16, modifiers: NSEvent.ModifierFlags)
        -> ComposerKeyIntent {
        let held = modifiers.intersection(meaningful)
        switch code {
        case returnKey, keypadEnterKey: return whatReturnMeans(under: held)
        case downArrowKey: return held.isEmpty ? .walkDown : .pass
        case upArrowKey: return held.isEmpty ? .walkUp : .pass
        case escapeKey: return held.isEmpty ? .dismiss : .pass
        default: return .pass
        }
    }

    /// Which meaning Return takes. Command or Control held is somebody reaching for a shortcut, and
    /// a Turn sent out from under a missed shortcut is the one outcome here with no undo.
    private static func whatReturnMeans(under held: NSEvent.ModifierFlags) -> ComposerKeyIntent {
        if held.contains(.command) || held.contains(.control) {
            return .pass
        }
        return held.isEmpty ? .submit : .newline
    }
}
