import MetalKit

/// The `MTKView` the map is drawn in, with the one thing an `NSViewRepresentable` cannot express:
/// where the pointer is (#1153).
///
/// A tracking area rather than SwiftUI's `onContinuousHover`, because the point has to be in the
/// coordinates of the DRAWABLE — this view's own — and a hover reported by a SwiftUI modifier is
/// in the coordinate space of whatever laid the overlay out. One conversion is one thing to get
/// wrong; two is the class of defect the id target exists to remove.
final class AtlasMapView: MTKView {
    var moved: ((CGPoint?) -> Void)?
    /// Where the reader clicked, in the same coordinates `moved` reports (#1154). A click and a
    /// hover are one question asked twice, so they arrive through one view and are answered
    /// against one frame — a click routed through a SwiftUI gesture instead would be a second
    /// coordinate space to convert, which is the class of defect the id target exists to remove.
    var clicked: ((CGPoint) -> Void)?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        // `.inVisibleRect` so the area follows the view through every resize the room does to it,
        // rather than being rebuilt against a rect that has already moved.
        addTrackingArea(NSTrackingArea(
            rect: .zero,
            options: [.mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
            owner: self,
        ))
    }

    override func mouseMoved(with event: NSEvent) {
        moved?(convert(event.locationInWindow, from: nil))
    }

    override func mouseExited(with _: NSEvent) {
        moved?(nil)
    }

    override func mouseDown(with event: NSEvent) {
        clicked?(convert(event.locationInWindow, from: nil))
    }
}
