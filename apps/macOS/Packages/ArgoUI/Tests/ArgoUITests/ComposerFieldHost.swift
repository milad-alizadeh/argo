import AppKit
import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A `SessionComposer` hosted for real, holding what it was sent and what it holds: the field a
/// test presses keys at, the draft and Turns behind it, and the wait that lets SwiftUI write back
/// before anything is asserted.
///
/// The claims it is driven through are `ComposerFieldKeyTests`.
///
/// Stated `@MainActor` because a nested type inherits its suite's isolation on some toolchains and
/// not others: Swift 6.3 gives it, so a nested version builds clean on this desk while CI reports
/// `keyDown(with:)` as a call into the main actor from a nonisolated context (#932).
@MainActor
final class ComposerFieldHost {
    /// What the composer is driven through: the draft it writes and the Turns it delivered.
    @Observable final class Store {
        var draft = ComposerDraft()
        var sent: [String] = []
    }

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

    static func hosted() throws -> ComposerFieldHost {
        let store = Store()
        let composer = SessionComposer(
            composer: ComposerSpecimen.composer,
            intents: DeckIntents(
                send: { text, _ in store.sent.append(text) },
                draft: Binding(get: { store.draft }, set: { store.draft = $0 }),
            ),
        )
        let host = NSHostingView(rootView: AnyView(composer.argoAppearance()))
        host.frame = NSRect(x: 0, y: 0, width: 640, height: 200)
        host.layoutSubtreeIfNeeded()
        let input = try #require(
            Self.field(in: host),
            "The composer hosted no text view.",
        )
        return ComposerFieldHost(host: host, input: input, store: store)
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
