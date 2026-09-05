import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The file resolved at a point is the file DRAWN at that point (#1153).
///
/// The claim is checked the only way it can be honestly checked: by drawing the map and reading
/// both attachments back, pixel for pixel, at a sweep of cameras rather than at the opening one.
/// Every hit-test defect the prototype had was a pick resolving against a camera the frame was not
/// drawn with, and every one of them survived a test that re-derived the projection instead of
/// rendering it — a second copy of the arithmetic agrees with itself at any angle.
///
/// The picture is read back as a HUE, because the light model is a scalar multiply on the band's
/// own pigment (#1151): a lit roof, a raked wall and a wall at the foot of its contact gradient are
/// three values of one hue, and every grey on the map — desktop, plates, rims, shadow decals — is a
/// cool hue no band has. So the picture says which band it is drawn in without a single claim about
/// how bright anything came out.
@Suite("Atlas — picking is the picture", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasPickingTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

    /// The cameras the sweep runs. Both ends of `relief` and three points between, crossed with
    /// four turns and three tilts — including a yaw past the 45° the opening view sits at, which is
    /// where the reader's own drag reaches (#1152) and where a drifting pick would show first.
    static let cameras: [Sweep] = {
        let reliefs = [0.0, 0.3, 0.6, 0.85, 1.0]
        let yaws = [0.0, 0.4, .pi / 4, 1.9, 3.4]
        let pitches = [0.2, 0.6155, 1.3]
        return reliefs.flatMap { relief in
            yaws.enumerated().map { index, yaw in
                Sweep(relief: relief, yaw: yaw, pitch: pitches[index % pitches.count])
            }
        }
    }()

    /// One camera of the sweep, named rather than a tuple so a failure message can say which of
    /// the twenty it was.
    struct Sweep {
        let relief: Double
        let yaw: Double
        let pitch: Double
    }

    /// A grid of files on one plate, each a different band from every neighbour it touches.
    ///
    /// The banding is the point. A pick that drifted by one tile would land on a file of a
    /// DIFFERENT
    /// band, so the picture and the id disagree and the test reds — where a grid of one colour
    /// would
    /// let a whole column of drift through as a picture that still looked right.
    ///
    /// Heights vary so the city has a skyline: a tower has to be able to stand in front of the file
    /// behind it, because covering one file with another is the case a pick has to get right and a
    /// flat map never poses.
    static func plan() -> AtlasPlan {
        let extent = CGSize(width: 200, height: 150)
        let bands: [AtlasBand] = [.quiet, .middling, .hot]
        let tiles = (0 ..< 5).flatMap { (row: Int) -> [AtlasTile] in
            (0 ..< 6).map { (column: Int) -> AtlasTile in
                let x = CGFloat(column) * 32 + 4
                let y = CGFloat(row) * 28 + 6
                let storeys = (column * 7 + row * 3) % 5
                return AtlasTile(
                    path: "argo/plate/file-\(row)-\(column)",
                    rect: CGRect(x: x, y: y, width: 32, height: 28),
                    band: bands[(column + row * 2) % bands.count],
                    height: CGFloat(4 + storeys * 9),
                )
            }
        }
        return AtlasPlan(
            extent: extent,
            plates: [.init(
                path: "argo/plate",
                rect: CGRect(origin: .zero, size: extent),
                depth: 0,
            )],
            tiles: tiles,
        )
    }

    /// Every fifth pixel of the frame, which is 1,200 samples a camera and 30,000 over the sweep.
    /// A grid rather than the whole frame: the claim is per pixel and holds at any stride, and
    /// reading every one of them would spend the suite's time proving the same thing again.
    static let step = 5

    /// Why a `#require` on the harness can fail even under the suite's own gate: the trait asks
    /// whether the shader compiles, and this asks for the textures too.
    static let unrenderable: Comment = "no Metal device or no compiled shader on this machine"

    /// THE CLAIM. Over every camera in the sweep, every sampled pixel's id names the file that
    /// pixel is painted as — and a pixel painted as no file names none.
    @Test func `the file resolved at a point is the file drawn at that point`() async throws {
        let harness = try #require(AtlasPickHarness(), Self.unrenderable)
        let plan = Self.plan()
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)
        // Every file in the fixture carries a band, which is what makes the picture readable back
        // to one: an unmeasured file is painted the material grey and would read as no file at all.
        let bands = plan.tiles.reduce(into: [String: AtlasBand]()) { bands, tile in
            bands[tile.path] = tile.band
        }

        for camera in Self.cameras {
            let frame = try #require(await harness.frame(
                of: city,
                plan: plan,
                through: AtlasCamera(
                    relief: camera.relief,
                    orientation: AtlasOrientation(yaw: camera.yaw, pitch: camera.pitch),
                    over: plan.extent,
                ),
            ))
            let wrong = Self.disagreements(in: frame, from: harness, bands: bands)
            #expect(
                wrong.isEmpty,
                """
                the pick and the picture disagree at relief \(camera.relief), \
                yaw \(camera.yaw), pitch \(camera.pitch): \(wrong.prefix(4))
                """,
            )
        }
    }

    /// A point on NO box resolves to nothing rather than to the nearest. The camera is turned far
    /// enough that a corner of the frame is bare ground, and the ground is what a reader most often
    /// points at — a pick that answered with the nearest file would name one from a whole corner
    /// away.
    @Test func `a point on no box resolves to nothing`() async throws {
        let harness = try #require(AtlasPickHarness(), Self.unrenderable)
        let plan = Self.plan()
        let frame = try #require(await harness.frame(
            of: AtlasVolumes.city(of: plan, in: Self.pigments),
            plan: plan,
            through: AtlasCamera.city(over: plan.extent),
        ))

        // The top left of the frame: the city is fitted inside its own bounding box, so a corner of
        // a turned map is ground the map cannot reach.
        #expect(harness.pick(at: AtlasPixel(x: 0, y: 0))?.file == nil)
        #expect(frame.band(atPixel: 0) == nil)
    }

    /// Every pixel where the id and the picture do not say the same thing, named by where it is and
    /// what each of the two claimed. The message is the diagnosis: a defect here is a pick against
    /// the wrong camera, and which files it confused says which way it drifted.
    @MainActor
    private static func disagreements(
        in frame: AtlasFrame,
        from harness: AtlasPickHarness,
        bands: [String: AtlasBand],
    )
        -> [String] {
        var wrong: [String] = []
        for y in Swift.stride(from: 0, to: AtlasPickHarness.size.height, by: step) {
            for x in Swift.stride(from: 0, to: AtlasPickHarness.size.width, by: step) {
                let picked = harness.pick(at: AtlasPixel(x: x, y: y))?.file
                let resolved = picked.flatMap { bands[$0] }
                let drawn = frame.band(atPixel: y * AtlasPickHarness.size.width + x)
                if resolved != drawn {
                    wrong.append("(\(x),\(y)) picked \(picked ?? "nothing"), drawn \(drawn as Any)")
                }
            }
        }
        return wrong
    }
}
