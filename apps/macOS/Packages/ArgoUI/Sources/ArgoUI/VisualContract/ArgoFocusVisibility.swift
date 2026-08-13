import AppKit

/// Whether a focus ring drawn right now would be answering the keyboard.
///
/// SwiftUI has no `:focus-visible`. A view is focused whether a key or a click put it there, and
/// the only switch on the system effect — `focusEffectDisabled()` — is all-or-nothing. So every
/// surface drawing its own ring asks this first, and a pointer reader never sees a keyboard
/// cursor (#533).
///
/// The last event the app saw is the whole answer: a reader working the keys just pressed one, and
/// a reader working the mouse just clicked.
@MainActor @Observable final class ArgoFocusVisibility {
    /// The app's one reader, and the only instance watching events. A suite makes its own and
    /// states the events itself, rather than sharing this one's mutable answer.
    static let shared: ArgoFocusVisibility = {
        let visibility = ArgoFocusVisibility()
        visibility.watch()
        return visibility
    }()

    /// Whether the reader is working by keyboard. Starts false: a window is opened with a pointer.
    private(set) var isOn = false

    private var monitor: Any?

    /// Local, so it sees only this app's events, and it passes every one of them straight on.
    private func watch() {
        monitor = NSEvent.addLocalMonitorForEvents(
            matching: [.keyDown, .leftMouseDown, .rightMouseDown, .otherMouseDown],
        ) { [weak self] event in
            MainActor.assumeIsolated { self?.note(event.type) }
            return event
        }
    }

    /// The reading itself, apart from the monitor so a suite can state an event without an app.
    ///
    /// Mouse-UP and mouse-DRAGGED are deliberately not watched: a reader who clicked to place a
    /// text cursor and then typed is working the keyboard again by the first key.
    func note(_ event: NSEvent.EventType) {
        switch event {
        case .keyDown:
            isOn = true
        case .leftMouseDown, .rightMouseDown, .otherMouseDown:
            isOn = false
        default:
            break
        }
    }
}
