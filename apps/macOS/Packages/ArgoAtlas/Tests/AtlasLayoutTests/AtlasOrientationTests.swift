@testable import AtlasLayout
import Testing

/// The turn and tilt the reader drives, apart from the camera that reads them (#1152).
@Suite("Atlas — the orientation the reader turns")
struct AtlasOrientationTests {
    /// Yaw is free: a reader who spins the ball past a full turn gets the angle they dragged to,
    /// not one wrapped or refused.
    @Test func `yaw is never held back`() {
        let spun = AtlasOrientation(yaw: 12.5, pitch: AtlasOrientation.opening.pitch)
        #expect(spun.yaw == 12.5)
    }

    /// A tilt past either end of the range is held at it, so a long drag cannot reach a pitch
    /// nothing downstream could read a city from.
    @Test(arguments: [
        (-5.0, AtlasOrientation.pitchRange.lowerBound),
        (5.0, AtlasOrientation.pitchRange.upperBound),
    ])
    func `pitch is held inside its range`(given: Double, held: Double) {
        #expect(AtlasOrientation(yaw: 0, pitch: given).pitch == held)
    }

    /// The whole of the range is reachable, not just its ends.
    @Test func `a pitch inside the range passes through unchanged`() {
        #expect(AtlasOrientation(yaw: 0, pitch: 0.7).pitch == 0.7)
    }

    /// Turning adds to the orientation it started from, which is what makes a drag or a key press
    /// a delta on the last angle rather than an absolute one it has to recompute.
    @Test func `turning adds the delta to both angles`() {
        let start = AtlasOrientation(yaw: 0.5, pitch: 0.7)
        let turned = start.turned(yaw: 0.2, pitch: 0.1)
        #expect(turned.yaw == 0.7)
        #expect(abs(turned.pitch - 0.8) < 0.000_001)
    }

    /// The same clamp applies on the way THROUGH a turn, not only at construction — a tilt that
    /// was already at the edge and turned further into it stays at the edge rather than only
    /// clamping the first time.
    @Test func `turning past the edge holds at the edge`() {
        let atEdge = AtlasOrientation(yaw: 0, pitch: AtlasOrientation.pitchRange.upperBound)
        let pushedFurther = atEdge.turned(yaw: 0, pitch: 1)
        #expect(pushedFurther.pitch == AtlasOrientation.pitchRange.upperBound)
    }
}
