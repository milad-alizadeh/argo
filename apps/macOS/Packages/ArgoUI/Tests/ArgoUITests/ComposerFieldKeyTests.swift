import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// The composer's field with keys actually pressed at it (#734).
///
/// A hosted view and a synthesized event, because the claim is about the seam between AppKit and
/// the
/// draft: `ComposerKeyIntentTests` proves what a keystroke MEANS, and nothing there proves the
/// meaning is carried out. The e2e case over the same two keys costs a launch of the whole app;
/// this
/// costs a layout pass.
@Suite("Composer field keys")
@MainActor struct ComposerFieldKeyTests {
    @Test
    func `shift held with Return breaks the line and the draft holds both`() throws {
        let field = try Self.hosted()

        field.input.insertText("first", replacementRange: field.input.selectedRange())
        field.press(.shift)
        field.input.insertText("second", replacementRange: field.input.selectedRange())

        #expect(field.input.string == "first\nsecond")
        #expect(field.draft.text == "first\nsecond")
    }

    @Test
    func `a bare Return sends the Turn and empties the field`() throws {
        let field = try Self.hosted()

        field.input.insertText("send me", replacementRange: field.input.selectedRange())
        #expect(field.draft.text == "send me")

        field.press([])
        field.settle { field.input.string.isEmpty }

        #expect(field.sent == ["send me"])
        #expect(field.draft.text.isEmpty)
        #expect(field.input.string.isEmpty)
    }

    /// A composer hosted for real, holding what it was sent and what it holds.
    private final class Hosted {
        let host: NSHostingView<AnyView>
        let input: ComposerTextInput
        let store: Store

        init(host: NSHostingView<AnyView>, input: ComposerTextInput, store: Store) {
            self.host = host
            self.input = input
            self.store = store
        }

        var draft: ComposerDraft {
            store.draft
        }

        var sent: [String] {
            store.sent
        }

        /// Return under `modifiers`, as the field's own `keyDown` sees it, followed by a layout
        /// pass — but a layout pass is not a promise, which is `settle`'s subject below.
        func press(_ modifiers: NSEvent.ModifierFlags) {
            guard let event = NSEvent.keyEvent(
                with: .keyDown,
                location: .zero,
                modifierFlags: modifiers,
                timestamp: 0,
                windowNumber: 0,
                context: nil,
                characters: "\r",
                charactersIgnoringModifiers: "\r",
                isARepeat: false,
                keyCode: ComposerKeyIntent.returnKey,
            ) else { return }
            input.keyDown(with: event)
            host.layoutSubtreeIfNeeded()
        }

        /// Turn the run loop until the control reflects the state, and give up rather than hang.
        ///
        /// SwiftUI writes state back into a hosted AppKit control on a run-loop turn of its OWN, so
        /// `layoutSubtreeIfNeeded` can return before the write-back has happened. Asserting
        /// straight after it reads whichever side of that turn the machine happened to be on: under
        /// load this suite saw the store hold the sent Turn and an empty draft while the text view
        /// still showed what had been typed — the store right, the control stale, which is that gap
        /// exactly (#918).
        func settle(until settled: () -> Bool) {
            let deadline = Date(timeIntervalSinceNow: 5)
            while !settled(), Date() < deadline {
                RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.001))
                host.layoutSubtreeIfNeeded()
            }
        }
    }

    /// What the composer is driven through: the draft it writes and the Turns it delivered.
    @Observable final class Store {
        var draft = ComposerDraft()
        var sent: [String] = []
    }

    private static func hosted() throws -> Hosted {
        let store = Store()
        let composer = SessionComposer(
            composer: ComposerSpecimen.composer,
            send: { text, _ in store.sent.append(text) },
            draft: Binding(get: { store.draft }, set: { store.draft = $0 }),
        )
        let host = NSHostingView(rootView: AnyView(composer.argoAppearance()))
        host.frame = NSRect(x: 0, y: 0, width: 640, height: 200)
        host.layoutSubtreeIfNeeded()
        let input = try #require(
            Self.field(in: host),
            "The composer hosted no text view.",
        )
        return Hosted(host: host, input: input, store: store)
    }

    private static func field(in view: NSView) -> ComposerTextInput? {
        if let input = view as? ComposerTextInput {
            return input
        }
        for child in view.subviews {
            if let found = field(in: child) {
                return found
            }
        }
        return nil
    }
}
