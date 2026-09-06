@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// The two pieces of geometry the map's smaller moves are drawn from (#1425): how much of the pin
/// has been drawn, and where the light along a cord has got to.
///
/// Both are pure, which is the whole reason they are here rather than in a `Canvas`: a move is a
/// number over time, and the number is checkable without a frame.
@Suite("Atlas — the moves that run on a clock")
struct AtlasClockTests {
    /// An L of two strokes, three points and three units of length, so a share of the whole falls
    /// in a different stroke from the share of either.
    static let bent = AtlasTrace(strokes: [
        [CGPoint(x: 0, y: 0), CGPoint(x: 2, y: 0)],
        [CGPoint(x: 2, y: 0), CGPoint(x: 2, y: 1)],
    ])

    @Test func `the whole trace is every segment of every stroke`() {
        #expect(Self.bent.length == 3)
    }

    /// The settled mark is the mark, exactly: a pin held at the end of its clock must be the same
    /// shape as one drawn with no clock at all, or the map would hold a slightly wrong box forever.
    @Test func `a finished pin is the trace itself`() {
        #expect(Self.bent.strokes(drawnTo: 1) == Self.bent.strokes)
        #expect(Self.bent.strokes(drawnTo: 1.4) == Self.bent.strokes)
    }

    @Test func `a pin that has not started draws nothing`() {
        #expect(Self.bent.strokes(drawnTo: 0).isEmpty)
        #expect(Self.bent.strokes(drawnTo: -0.2).isEmpty)
    }

    /// ONE budget across the strokes in order. A third of the way through, the first stroke is a
    /// third drawn and the second has not started — a share spent per stroke instead would have
    /// both of them a third done, which reads as the box growing rather than as a line drawn.
    @Test func `the budget is spent stroke by stroke, in order`() {
        let drawn = Self.bent.strokes(drawnTo: 1.0 / 3)

        #expect(drawn.count == 1)
        #expect(drawn.first?.last == CGPoint(x: 1, y: 0))
    }

    /// The budget running out mid-segment cuts that segment rather than dropping or completing it,
    /// which is what makes the mark travel smoothly rather than in five steps.
    @Test func `a budget that runs out inside a stroke cuts it there`() {
        let drawn = Self.bent.strokes(drawnTo: 5.0 / 6)

        #expect(drawn.count == 2)
        #expect(drawn.last == [CGPoint(x: 2, y: 0), CGPoint(x: 2, y: 0.5)])
    }

    /// A stroke the budget stops exactly at the start of is dropped: one point is a move with
    /// nothing after it, and a stroked move is a dot at the corner of the box.
    @Test func `a stroke the budget never enters is dropped rather than left as a point`() {
        let drawn = Self.bent.strokes(drawnTo: 2.0 / 3)

        #expect(drawn.count == 1)
        #expect(drawn.first?.last == CGPoint(x: 2, y: 0))
    }

    static let cord = AtlasCord(
        between: AtlasTile(
            path: "a", rect: CGRect(x: 0, y: 0, width: 20, height: 20), band: .quiet, height: 1,
        ),
        and: AtlasTile(
            path: "b", rect: CGRect(x: 200, y: 200, width: 20, height: 20), band: .hot, height: 1,
        ),
        through: AtlasProjection(
            of: AtlasPlan(
                extent: CGSize(width: 400, height: 400),
                plates: [.init(
                    path: "a", rect: CGRect(x: 0, y: 0, width: 400, height: 400), depth: 0,
                )],
                tiles: [],
            ),
            through: AtlasCamera(
                relief: 0, orientation: .opening, over: CGSize(width: 400, height: 400),
            ),
        ),
        strength: 0.5,
    )

    /// The ends of the travel are the ends of the cord. A parameter that did not land on them
    /// would start the light off the first roof and finish it short of the second, which reads as
    /// a tie between two files it is not between.
    @Test func `the light starts on one roof and finishes on the other`() throws {
        let cord = try #require(Self.cord)

        #expect(cord.point(at: 0) == cord.start)
        #expect(cord.point(at: 1) == cord.end)
    }

    /// Off the chord, on the same side the control point is: a cord is bowed, and light travelling
    /// down the straight line between two roofs would be light on a cord nobody drew.
    @Test func `the light travels the bow rather than the chord`() throws {
        let cord = try #require(Self.cord)
        let middle = cord.point(at: 0.5)
        let chord = CGPoint(
            x: (cord.start.x + cord.end.x) / 2, y: (cord.start.y + cord.end.y) / 2,
        )

        #expect(middle != chord)
        // Halfway along a quadratic is halfway between the chord's middle and the control point.
        #expect(abs(middle.x - (chord.x + cord.control.x) / 2) < 0.000_001)
        #expect(abs(middle.y - (chord.y + cord.control.y) / 2) < 0.000_001)
    }
}
