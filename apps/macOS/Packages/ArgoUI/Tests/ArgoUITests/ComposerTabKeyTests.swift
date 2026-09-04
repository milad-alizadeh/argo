import AppKit
@testable import ArgoUI
import Testing

/// Tab at the composer's field: it takes the row under an open menu's cursor, and stays the focus
/// walk where there is no row to take (#1181).
///
/// `ComposerKeyIntentTests` proves what the key MEANS; this proves the field carries the meaning
/// out. Two kinds of claim, and only one of them needs a window: whether the menu is ASKED is the
/// field's own dispatch, and whether focus actually moved is AppKit's key-view loop.
@Suite("Composer Tab key")
@MainActor struct ComposerTabKeyTests {
    @Test
    func `a Tab is offered to the menu before anything else takes it`() throws {
        let input = ComposerTextInput(frame: Self.frame)
        var asked = 0
        input.complete = {
            asked += 1
            return true
        }

        try input.keyDown(with: Self.tab())

        #expect(asked == 1)
        #expect(input.string.isEmpty)
    }

    /// The empty state, and every line that opens no menu at all: nothing to take, so the key falls
    /// through — and never leaves a `\t` in the draft, which is what a text view would insert.
    @Test
    func `a Tab the menu declines still types nothing`() throws {
        let input = ComposerTextInput(frame: Self.frame)
        input.complete = { false }

        try input.keyDown(with: Self.tab())

        #expect(input.string.isEmpty)
    }

    /// Shift-Tab does nothing to the menu: it is the walk backwards, and the menu is never asked.
    @Test
    func `shift held with Tab never asks the menu`() throws {
        let input = ComposerTextInput(frame: Self.frame)
        var asked = 0
        input.complete = {
            asked += 1
            return true
        }

        try input.keyDown(with: Self.tab(.shift))

        #expect(asked == 0)
        #expect(input.string.isEmpty)
    }

    /// Where the walk itself is asserted, which needs a window: `selectNextKeyView` on a view with
    /// no window does nothing at all, so a test without one cannot tell a swallowed Tab from a
    /// walked one. Gated for `WindowedTests`' reason — on a headless runner the key-view loop is
    /// the runner's behaviour as much as the code's.
    @Suite("Composer Tab key — the focus walk")
    @MainActor struct Walk {
        @Test(.enabled(if: WindowedTests.areAvailable))
        func `a Tab the menu took leaves focus where it is`() throws {
            let rig = Rig()
            rig.input.complete = { true }

            try rig.input.keyDown(with: tab())

            #expect(rig.window.firstResponder === rig.input)
        }

        /// The walk #718 built, untouched on every line with no row under a cursor to take.
        @Test(.enabled(if: WindowedTests.areAvailable))
        func `a Tab the menu declined walks focus on`() throws {
            let rig = Rig()
            rig.input.complete = { false }

            try rig.input.keyDown(with: tab())

            #expect(rig.window.firstResponder === rig.next)
        }

        @Test(.enabled(if: WindowedTests.areAvailable))
        func `shift held with Tab walks focus backwards`() throws {
            let rig = Rig()
            rig.input.complete = { true }

            try rig.input.keyDown(with: tab(.shift))

            #expect(rig.window.firstResponder === rig.next)
        }

        /// Two fields in a window, the second standing for the footer's controls #718's walk
        /// reaches. It is a `ComposerTextInput` too, because an editable text view takes first
        /// responder on every desk: whether a button does depends on the machine's Full Keyboard
        /// Access.
        ///
        /// Stated `@MainActor` for `ComposerFieldHost`'s reason: a nested type inherits its suite's
        /// isolation on some toolchains and not others, and AppKit's initialisers are the main
        /// actor's.
        @MainActor private final class Rig {
            let window: NSWindow
            let input: ComposerTextInput
            let next: ComposerTextInput

            init() {
                self.window = NSWindow(
                    contentRect: NSRect(x: 0, y: 0, width: 320, height: 120),
                    styleMask: [.titled],
                    backing: .buffered,
                    defer: false,
                )
                self.input = ComposerTextInput(frame: NSRect(x: 0, y: 60, width: 320, height: 60))
                self.next = ComposerTextInput(frame: NSRect(x: 0, y: 0, width: 320, height: 60))
                window.contentView?.addSubview(input)
                window.contentView?.addSubview(next)
                input.nextKeyView = next
                next.nextKeyView = input
                window.makeFirstResponder(input)
            }
        }

        private func tab(_ modifiers: NSEvent.ModifierFlags = []) throws -> NSEvent {
            try ComposerTabKeyTests.tab(modifiers)
        }
    }

    fileprivate static let frame = NSRect(x: 0, y: 0, width: 320, height: 60)

    fileprivate static func tab(_ modifiers: NSEvent.ModifierFlags = []) throws -> NSEvent {
        try #require(NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: modifiers,
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "\t",
            charactersIgnoringModifiers: "\t",
            isARepeat: false,
            keyCode: ComposerKeyIntent.tabKey,
        ))
    }
}
