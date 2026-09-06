@testable import AtlasLayout
import CoreGraphics
import Testing

/// The flight between two seats (#1423).
///
/// `AtlasSeatTests` holds where a descent puts the camera and the bounds it may not leave. This
/// holds what runs BETWEEN two of those, which is the whole of this ticket: #1490 left a camera
/// that cuts, and every claim here is about the frames a cut does not have.
@Suite("Atlas — the flight between two seats")
struct AtlasFlightTests {
    static func seats() throws -> (whole: AtlasSeat, inside: AtlasSeat) {
        let plan = try AtlasSeatFixture.plan()
        return (
            AtlasSeat(standingIn: nil, of: plan),
            AtlasSeat(standingIn: AtlasSeatFixture.deep, of: plan),
        )
    }

    /// The seat a folder names, reached from outside the package, is the seat `AtlasFit` seats on.
    /// The room holds no plan of its own arithmetic, so this is the one spelling under test.
    @Test func `the public seat is the one the fit seats on`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let reached = AtlasFit(
            seatedAt: AtlasSeat(standingIn: AtlasSeatFixture.deep, of: plan),
            into: plan.extent,
        )

        #expect(
            reached == AtlasFit(
                framing: plan, through: camera, into: plan.extent,
                standingIn: AtlasSeatFixture.deep,
            ),
        )
    }

    /// **Both ends of a flight are the pictures a cut would have given**, to the last decimal
    /// place. A flight that eased nicely and landed one part in a thousand off would look right in
    /// motion and be wrong in the still nobody took.
    @Test func `a flight starts and lands on the exact seats`() throws {
        let (whole, inside) = try Self.seats()

        #expect(whole.lerp(to: inside, 0) == whole)
        #expect(whole.lerp(to: inside, 1) == inside)
    }

    /// **The discriminating claim.** Interpolating the three numbers is d3's zoomable treemap move;
    /// interpolating the visible WINDOW — linear in 1/zoom — is what the zoomable sunburst does,
    /// and it bends every rect's path across the screen. Halfway is where the two disagree, so
    /// halfway is where the fork is stated rather than described.
    @Test func `halfway is linear in the zoom, not in the window`() throws {
        let (whole, inside) = try Self.seats()

        let half = whole.lerp(to: inside, 0.5)

        #expect(abs(half.zoom - (whole.zoom + inside.zoom) / 2) < 0.000_001)
        // The window lerp lands on the harmonic mean, which is strictly smaller for two different
        // zooms — so the two really are different pictures and not two spellings of one.
        #expect(2 / (1 / whole.zoom + 1 / inside.zoom) < half.zoom - 0.001)
    }

    /// Every frame of a flight is a picture, so no frame of one may be undrawable: a zoom of
    /// nothing reaches the shader as a NaN and takes the map with it.
    @Test(arguments: [0.0, 0.25, 0.5, 0.75, 1.0])
    func `every frame of a flight can be drawn`(share: Double) throws {
        let (whole, inside) = try Self.seats()

        #expect(whole.lerp(to: inside, share).isDrawable)
    }

    /// The share is held at its ends. `snap` eases out and does not overshoot, but a role is a
    /// value somebody may change — and an overshoot here is a camera past the plate it was flying
    /// to, or a zoom run backwards through zero, which is the picture inside out.
    @Test func `a share outside the flight is held at its ends`() throws {
        let (whole, inside) = try Self.seats()

        #expect(whole.lerp(to: inside, -3) == whole)
        #expect(whole.lerp(to: inside, 42) == inside)
    }

    /// The seam the flight needs: mid-air the reader is ALREADY standing in a folder and the camera
    /// is not there yet, so a projection can be asked for a SEAT rather than for a folder. The two
    /// initializers are the two readings, and this is the one no folder can name.
    @Test func `a projection can be asked for a seat rather than a folder`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)
        let (whole, inside) = try Self.seats()

        let flying = AtlasProjection(of: plan, through: camera, seatedAt: whole.lerp(to: inside, 0))

        #expect(flying.fit == AtlasProjection(of: plan, through: camera).fit)
    }

    /// And asked for a folder, a projection is the one #1490 already drew — so every caller that
    /// never flies anywhere is untouched by this.
    @Test func `a projection asked for a folder is the picture it always was`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let settled = AtlasProjection(
            of: plan, through: camera, standingIn: AtlasSeatFixture.deep,
        )

        #expect(
            settled.fit == AtlasFit(
                framing: plan, through: camera, into: plan.extent,
                standingIn: AtlasSeatFixture.deep,
            ),
        )
    }

    /// **A seat may not be carried into the city.** `AtlasFit.seat` refuses to seat a turned
    /// camera, and a seat handed straight to a projection is that rule's other door: its middle is
    /// a point on the eye's plane solved at NO relief, so spending it on a standing city magnifies
    /// the picture onto somewhere that means nothing in it.
    ///
    /// Reachable by a reader rather than hypothetical: descend into a folder, then turn the city
    /// on from the sidebar.
    @Test(arguments: [1.0, 0.5, 0.02])
    func `a turned camera is never drawn at a seat`(relief: Double) throws {
        let plan = try AtlasSeatFixture.plan()
        let turning = AtlasCamera(relief: relief, over: plan.extent)
        let (_, inside) = try Self.seats()

        let seated = AtlasProjection(of: plan, through: turning, seatedAt: inside)

        #expect(seated.fit == AtlasFit(framing: plan, through: turning, into: plan.extent))
    }

    /// And at the flat end it IS spent, which is the other half of the same claim: a guard that
    /// refused everywhere would be a flight that never flew.
    @Test func `the flat camera is drawn at the seat it is given`() throws {
        let plan = try AtlasSeatFixture.plan()
        let flat = AtlasCamera.flat(over: plan.extent)
        let (_, inside) = try Self.seats()

        let seated = AtlasProjection(of: plan, through: flat, seatedAt: inside)

        #expect(seated.fit == AtlasFit(seatedAt: inside, into: plan.extent))
        #expect(seated.fit != AtlasFit(framing: plan, through: flat, into: plan.extent))
    }
}
