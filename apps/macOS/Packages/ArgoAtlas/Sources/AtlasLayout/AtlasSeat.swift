import CoreGraphics

/// Where a seated camera is: the point on the eye's own plane it is centred on, and how much it
/// magnifies (#1490, flown at #1423).
///
/// The whole of what `AtlasFit` is solved from. #1490 derived it from a folder and threw it away
/// inside the initializer, which is right for a camera that only ever CUTS between two seats: a
/// folder names the seat, and no caller needs the number.
///
/// A flight needs the number. The seats either side of a descent are two of these and the frames
/// between them are neither, so the thing a `withAnimation` moves has to be this rather than the
/// folder that names it — you cannot interpolate a path. Three scalars, which is exactly the
/// prototype's `scale`, `ox` and `oy` (`docs/designs/cockpit-atlas.html`, `flyTo`).
public struct AtlasSeat: Equatable, Sendable {
    /// The point the picture is centred on, in eye-plane units.
    public let middle: CGPoint

    /// Eye-plane units to viewport points. Never zero or worse: a zoom of nothing reaches the
    /// shader as a NaN and takes the picture with it, so a seat that cannot be framed is refused
    /// where it is solved rather than held here.
    public let zoom: CGFloat

    public init(middle: CGPoint, zoom: CGFloat) {
        self.middle = middle
        self.zoom = zoom
    }

    /// Whether this seat can be drawn at all. Everything downstream frames the whole plan instead
    /// of asking again.
    public var isDrawable: Bool {
        zoom > 0 && zoom.isFinite && middle.x.isFinite && middle.y.isFinite
    }

    /// Part of the way from one seat to another, which is the whole of what a flight is.
    ///
    /// Linear in all three, which is d3's zoomable treemap move and NOT the sunburst's: the change
    /// of frame is a similarity shared by every rect, so interpolating this one transform is
    /// pointwise identical to interpolating every rectangle in the picture. Interpolating the
    /// visible WINDOW instead — linear in 1/zoom — would bend every rect's path across the screen.
    /// The prototype works the equivalence out in full above `flyTo`.
    public func lerp(to other: AtlasSeat, _ share: Double) -> AtlasSeat {
        let held = min(1, max(0, share))
        return AtlasSeat(
            middle: CGPoint(
                x: middle.x + (other.middle.x - middle.x) * held,
                y: middle.y + (other.middle.y - middle.y) * held,
            ),
            zoom: zoom + (other.zoom - zoom) * held,
        )
    }
}

public extension AtlasSeat {
    /// The seat one folder names on one plan, seen straight down (#1490's own arithmetic, reached
    /// from outside the package).
    ///
    /// FLAT, and that is the rule rather than a convenience: the city's camera is the reader's —
    /// they drive its turn and tilt — and a descent that seated it too would take the view away
    /// from whoever was looking through it. `AtlasFit` refuses to seat a turned camera for the same
    /// reason, so this asks it the one question it answers.
    ///
    /// The spelling the room reaches a seat through, so it holds no copy of the walk from a folder
    /// to the ground it stands on.
    init(standingIn folder: String?, of plan: AtlasPlan) {
        self = AtlasFit.seat(
            framing: plan,
            through: .flat(over: plan.extent),
            into: plan.extent,
            standingIn: folder,
        )
    }
}
