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
        field.settle { field.input.string == "first\nsecond" }

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

    /// The clear after a send reaches the field on every Turn, not only the first (#1000).
    ///
    /// Five Turns rather than two because the first one is the one that always worked: a send
    /// leaves the field stale only once something has already rendered at that value, so the
    /// staleness — and the line it concatenates onto the next Turn — begins at the second.
    @Test
    func `every Turn sent empties the field, not only the first`() throws {
        let field = try Self.hosted()

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
        let field = try Self.hosted()

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
        let first = try Self.hosted()
        let second = try Self.hosted()

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

    /// A composer hosted for real, holding what it was sent and what it holds.
    ///
    /// Stated `@MainActor` because a nested type inherits the suite's isolation on some toolchains
    /// and not others: Swift 6.3 gives it, so this file builds clean here while CI reports
    /// `keyDown(with:)` as a call into the main actor from a nonisolated context (#932).
    @MainActor private final class Hosted {
        let host: NSHostingView<AnyView>
        let input: ComposerTextInput
        let store: Store

        init(host: NSHostingView<AnyView>, input: ComposerTextInput, store: Store) {
            self.host = host
            self.input = input
            self.store = store
        }

        /// What the field is asking the vessel for, which is what a grown line costs the feed.
        var height: CGFloat {
            input.enclosingScrollView?.frame.height ?? 0
        }

        var draft: ComposerDraft {
            store.draft
        }

        var sent: [String] {
            store.sent
        }

        /// Return under `modifiers`, as the field's own `keyDown` sees it, followed by a layout
        /// pass — which is a REQUEST for the write-back and not a promise of it, so every caller
        /// asserting on the control's own string waits with `settle` first.
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

        /// Turn the run loop until the control agrees with the state behind it, and RECORD AN
        /// ISSUE at the caller's own line if it never does.
        ///
        /// SwiftUI writes state back into a hosted control on a run-loop turn of its own, so
        /// `layoutSubtreeIfNeeded` returning is not a promise that the write-back has happened.
        /// A wait that ran out silently would leave the `#expect` below it to fail instead,
        /// reporting the control as wrong when what is wrong is that nobody waited (#932).
        ///
        /// It turns the run loop rather than sleeping, because the write-back is queued ON this
        /// thread's run loop.
        ///
        /// Most waits settle on their first check. The ones that do not are the reconciliation
        /// `ComposerTextView` schedules a turn after the field reports a change (#1000), which
        /// needs a turn of this loop to arrive and lands in single-digit milliseconds.
        func settle(
            until settled: () -> Bool,
            at location: SourceLocation = #_sourceLocation,
        ) {
            let deadline = ContinuousClock.now + Self.settleLimit
            while ContinuousClock.now < deadline {
                if settled() {
                    return
                }
                RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.001))
                host.layoutSubtreeIfNeeded()
            }
            if settled() {
                return
            }
            Issue.record(
                "the field never caught up with its state within \(Self.settleLimit)",
                sourceLocation: location,
            )
        }

        /// A hang guard and not a budget: nothing here asserts how FAST the write-back lands. Ten
        /// seconds matches `ArgoEngineTests`' own bound, raised by `ARGO_SETTLE_LIMIT_SECONDS`.
        static let settleLimit: Duration = .seconds(
            ProcessInfo.processInfo.environment["ARGO_SETTLE_LIMIT_SECONDS"]
                .flatMap(Int.init) ?? 10,
        )
    }

    /// What the composer is driven through: the draft it writes and the Turns it delivered.
    @MainActor @Observable final class Store {
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
