import AppKit
import SwiftUI

/// Whether a focus ring drawn right now would be answering the keyboard.
///
/// SwiftUI has no `:focus-visible`. A view is focused whether a key or a click put it there, and
/// the only switch on the system effect — `focusEffectDisabled()` — is all-or-nothing. So every
/// surface drawing its own ring asks this first, and a pointer reader never sees a keyboard
/// cursor (#533).
///
/// The last event the app saw is the whole answer: a reader working the keys just pressed one, and
/// a reader working the mouse just clicked. One monitor rather than a gesture per control, because
/// a zero-distance `DragGesture` racing focus is a fact about ordering and this is a fact about
/// the reader.
///
/// The feed asks nothing of it: its cursor is the table's own `focusedRow`, which no click path
/// writes — see `FeedTableCoordinator`.
@MainActor @Observable public final class ArgoFocusVisibility {
    /// The app's one reader, and the only instance watching events. A suite makes its own and
    /// states the events itself, rather than sharing this one's mutable answer.
    public static let shared: ArgoFocusVisibility = {
        let visibility = ArgoFocusVisibility()
        visibility.watch()
        return visibility
    }()

    /// Whether the reader is working by keyboard. Starts false: a window is opened with a pointer.
    public private(set) var isOn = false

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
    /// text cursor and then typed is working the keyboard again by the first key, and nothing
    /// between the two changes that.
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

/// The one keyboard cursor, drawn from the contract's own tokens.
///
/// Hand-drawn rather than the system's for the reason every caller shares: the system effect
/// outlines the FOCUSABLE, which is routinely a larger box than the thing that was focused, and it
/// draws for a click as readily as for a key.
private struct ArgoFocusRing: ViewModifier {
    @Environment(\.argo) private var argo

    let isOn: Bool
    let radius: CGFloat

    func body(content: Content) -> some View {
        content.overlay {
            if isOn {
                RoundedRectangle(cornerRadius: radius)
                    .strokeBorder(argo.color.interaction.focusRing, lineWidth: ArgoStroke.focus)
            }
        }
    }
}

public extension View {
    /// The keyboard cursor around this view, on only while the keyboard is what the reader is
    /// working with. Pair it with `focusEffectDisabled()` on the focusable itself.
    @MainActor func argoFocusRing(
        _ isFocused: Bool,
        radius: CGFloat = ArgoRadius.control,
    )
        -> some View {
        modifier(ArgoFocusRing(
            isOn: isFocused && ArgoFocusVisibility.shared.isOn,
            radius: radius,
        ))
    }
}
