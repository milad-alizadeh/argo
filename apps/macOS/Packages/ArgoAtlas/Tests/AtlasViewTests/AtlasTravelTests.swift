import AtlasLayout
@testable import AtlasView
import CoreGraphics
import SwiftUI
import Testing

/// The map's smaller moves, where they are decided rather than where they are stroked (#1425): how
/// present the whole-map layer is while it arrives or leaves, and where the light along each cord
/// has got to.
@Suite("Atlas — the cords' clock")
struct AtlasTravelTests {
    /// **The layer is the whole-map reading alone.** The open file's own cords answer a question
    /// the reader just asked by clicking, and a question answered on a fade is a click that did
    /// not land.
    @Test func `only the whole-map cords fade with the layer`() {
        #expect(AtlasCordWeight.acrossTheMap.presence(0.4) == 0.4)
        #expect(AtlasCordWeight.ofTheOpenFile.presence(0.4) == 1)
        #expect(AtlasCordWeight.ofTheOpenFile.presence(0) == 1)
    }

    /// What the fade drives instead of the switch, so the layer is still drawn while it is going
    /// away — a set recomputed from the switch alone would be empty on the fade's first frame and
    /// there would be nothing left on screen to take away.
    @Test func `the ties can be shown against what the switch says`() {
        let off = AtlasTies(couplings: AtlasTieCordTests.couplings, isOn: false)

        #expect(off.shown(true).isOn)
        #expect(off.shown(true).couplings == off.couplings)
        #expect(!off.shown(false).isOn)
    }

    /// **The two clocks have to be an ANIMATABLE attribute, not state read in a body.** SwiftUI
    /// interpolates `animatableData`; a scalar a `Canvas` closure happens to capture is read once,
    /// at whatever value the body was evaluated with — so a layer that only fed the closure would
    /// pop on and off in one frame, and light that only fed it would be painted once off the end
    /// of its cord and sit there for the whole lap. Both roles would resolve to the cut the ticket
    /// exists to remove, and no still could tell.
    @MainActor @Test func `the cords' two clocks are what SwiftUI interpolates`() {
        var drawn = AtlasDrawnCords(
            cords: [],
            viewport: CGSize(width: 100, height: 100),
            travelling: true,
            clock: AtlasCordClock(layer: 0, lap: 0),
        )

        #expect(drawn.animatableData == AnimatablePair(0, 0))
        drawn.animatableData = AnimatablePair(0.25, 0.75)
        #expect(drawn.clock == AtlasCordClock(layer: 0.25, lap: 0.75))
    }

    static let cord = AtlasTieCordTests.cords(isOn: true).first

    static func travel(at place: Int, into lap: Double) throws -> AtlasTravel {
        try AtlasTravel(along: #require(cord), at: place, into: lap)
    }

    /// The head runs from BEFORE the first roof to PAST the second, so the light arrives and
    /// leaves rather than appearing in the middle of a cord and vanishing there.
    @Test func `the light arrives before the cord starts and leaves after it ends`() throws {
        #expect(try Self.travel(at: 0, into: 0).head < 0)
        // The end of the lap and not 1 itself: a lap is a place in a circle, and 1 is the same
        // place as 0 — which is the head back at the start rather than off the far end.
        #expect(try Self.travel(at: 0, into: 0.999).head > 1)
    }

    /// One clock for every cord, and this is what keeps them from pulsing in unison: two cords
    /// next to each other are at two different points of the same lap.
    @Test func `two cords are at different points of one lap`() throws {
        let first = try Self.travel(at: 0, into: 0.5).head
        let second = try Self.travel(at: 1, into: 0.5).head

        #expect(first != second)
    }

    /// The phase is a place in the lap, so a cord far enough down the list wraps rather than
    /// running off the end of one.
    @Test func `a cord's place in the lap wraps rather than running past it`() throws {
        let wrapped = try Self.travel(at: 0, into: 0.2).head
        // 1 / 0.137 is a little over seven, so the eighth cord is a whole lap on and a shade more.
        #expect(try Self.travel(at: 8, into: 0.2).head != wrapped)
        #expect(try Self.travel(at: 8, into: 0.2).head <= 1 + AtlasTravel.span)
    }

    /// Eased at BOTH ends. A lap whose ease flattens at only one end reads as a stutter once
    /// round, which is the whole reason the render does not use its own `ease` here.
    @Test func `the glide is still at both ends of the lap`() {
        #expect(AtlasTravel.glide(0) == 0)
        #expect(AtlasTravel.glide(1) == 1)
        #expect(abs(AtlasTravel.glide(0.5) - 0.5) < 0.000_001)
        // Nearly nothing has happened a twentieth of the way in, and nearly nothing is left in the
        // last twentieth: that is what "still at both ends" means as a number.
        #expect(AtlasTravel.glide(0.05) < 0.005)
        #expect(AtlasTravel.glide(0.95) > 0.995)
    }
}
