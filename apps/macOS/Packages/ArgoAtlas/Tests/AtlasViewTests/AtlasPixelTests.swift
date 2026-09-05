@testable import AtlasView
import CoreGraphics
import Testing

/// The one piece of arithmetic left between the pointer and the picture (#1153).
///
/// `AtlasPickingTests` proves the id target agrees with the screen, and it proves that by
/// RENDERING — nothing there re-derives a projection, so nothing there can drift. What it cannot
/// reach is the step before it: a pointer arrives in a view's points, counted up from the bottom
/// left, and the target is in the drawable's pixels, counted down from the top. That conversion has
/// no picture to be checked against, so it is checked here.
@Suite("Atlas — a point of the view, as a pixel of the drawable")
struct AtlasPixelTests {
    /// The y axis turns over. A point spent as it arrives picks the file mirrored about the middle
    /// of the map — which is right at the middle and wrong everywhere else, and therefore the way
    /// this defect survives a look.
    @Test func `the top of the view is row zero of the drawable`() {
        let bounds = CGSize(width: 200, height: 100)

        let top = AtlasPixel(CGPoint(x: 0, y: 100), in: bounds, drawable: bounds)
        let bottom = AtlasPixel(CGPoint(x: 0, y: 0), in: bounds, drawable: bounds)

        #expect(top == AtlasPixel(x: 0, y: 0))
        #expect(bottom == AtlasPixel(x: 0, y: 100))
    }

    /// The backing scale, read off the drawable rather than off a screen. On a Retina display the
    /// drawable is twice the view, and a point spent unscaled picks the top left QUARTER of the map
    /// stretched over the whole of it.
    @Test func `a point scales by the drawable, not by the view`() {
        let bounds = CGSize(width: 200, height: 100)
        let drawable = CGSize(width: 400, height: 200)

        let pixel = AtlasPixel(CGPoint(x: 50, y: 75), in: bounds, drawable: drawable)

        #expect(pixel == AtlasPixel(x: 100, y: 50))
    }

    /// A view with no bounds yet — the state every `MTKView` is in before its first layout. There
    /// is no pixel a point of it could name, and a division by nothing would answer with one
    /// anyway.
    @Test func `a view with no size names no pixel`() {
        #expect(AtlasPixel(CGPoint(x: 4, y: 4), in: .zero, drawable: .zero) == nil)
    }
}
