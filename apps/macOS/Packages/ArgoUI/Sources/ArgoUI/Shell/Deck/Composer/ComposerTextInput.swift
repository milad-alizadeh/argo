import AppKit
import ArgoEngine

/// The text view under the composer's field — an `NSTextView` with the keys it must answer itself
/// (#734).
///
/// It exists because a caret does: a line can only be broken where the caret is, and a stock
/// `TextField` is an `NSTextField`, which offers none.
final class ComposerTextInput: NSTextView {
    /// Send the Turn, or take the row under an open menu's cursor.
    var submit: () -> Void = {}
    /// An arrow offered to whichever menu is open. `false` hands it back to the caret, so a line
    /// that opens no menu keeps the platform's own movement.
    var walk: (ComposerKeyIntent) -> Bool = { _ in false }
    /// Escape. `false` says no menu was open, and the key goes on up the responder chain — the
    /// permission footer's `esc denies` and the deck's own dismissals are all above this field.
    var dismiss: () -> Bool = { false }
    /// What ⌘V was holding, where it was holding files or pixels rather than words (#540).
    var attach: ([SessionAttachment]) -> Void = { _ in }

    override func keyDown(with event: NSEvent) {
        switch ComposerKeyIntent.intent(forKeyCode: event.keyCode, modifiers: event.modifierFlags) {
        case .submit: submit()
        case .newline: insertNewline(nil)
        case .walkDown where walk(.walkDown), .walkUp where walk(.walkUp): return
        case .dismiss where dismiss(): return
        case .walkDown, .walkUp, .dismiss, .pass: super.keyDown(with: event)
        }
    }

    // Tab moves focus, as it did at the stock field. A text view that is not a field editor inserts
    // a tab character instead, which costs every keyboard-only reader the footer's controls (#718's
    // walk) and quietly puts a `\t` in the draft.

    override func insertTab(_ sender: Any?) {
        window?.selectNextKeyView(sender)
    }

    override func insertBacktab(_ sender: Any?) {
        window?.selectPreviousKeyView(sender)
    }

    /// A pasted screenshot or file becomes an attachment rather than a path typed into the draft.
    ///
    /// While the field holds the keyboard ⌘V arrives HERE, ahead of the vessel's own
    /// `onPasteCommand`, so the gesture #540 built has to be answered at this level too.
    override func paste(_ sender: Any?) {
        let incoming = ComposerPasteboard.attachments()
        guard !incoming.isEmpty else { return super.paste(sender) }
        attach(incoming)
    }

    /// No ring of its own: the vessel around the field is what shows focus, exactly as the stock
    /// field drew nothing at `.plain`. The setter discards, because AppKit sets this itself.
    override var focusRingType: NSFocusRingType {
        get { .none }
        set {}
    }
}
