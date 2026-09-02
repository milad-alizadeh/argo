import AppKit
import ArgoAtoms
@testable import ArgoUI
import Testing

/// When a focus ring is answering the keyboard.
///
/// SwiftUI has no `:focus-visible`, so a view drawing its own ring would draw it for a click as
/// readily as for a key — a keyboard cursor shown to a pointer reader, which is #533. The last
/// event the app saw is what settles it.
@Suite("Focus visibility")
@MainActor
struct FocusVisibilityTests {
    @Test
    func `a window that has seen nothing yet shows no cursor`() {
        #expect(ArgoFocusVisibility().isOn == false)
    }

    @Test(arguments: [NSEvent.EventType.leftMouseDown, .rightMouseDown, .otherMouseDown])
    func `a reader who just clicked is shown no keyboard cursor`(_ click: NSEvent.EventType) {
        let visibility = ArgoFocusVisibility()
        visibility.note(.keyDown)

        visibility.note(click)

        #expect(visibility.isOn == false)
    }

    @Test
    func `a reader who just pressed a key is shown one`() {
        let visibility = ArgoFocusVisibility()
        visibility.note(.leftMouseDown)

        visibility.note(.keyDown)

        #expect(visibility.isOn)
    }

    /// A reader who clicked into a field and typed is working the keyboard again. Only a fresh
    /// click takes the cursor away, so nothing between the click and the key may.
    @Test(arguments: [NSEvent.EventType.leftMouseUp, .mouseMoved, .leftMouseDragged, .scrollWheel])
    func `letting go of the mouse is not itself a click`(_ after: NSEvent.EventType) {
        let visibility = ArgoFocusVisibility()
        visibility.note(.keyDown)

        visibility.note(after)

        #expect(visibility.isOn)
    }
}
