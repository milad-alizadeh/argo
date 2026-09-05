@testable import AtlasView
import AtlasLayout
import CoreGraphics
import Testing

/// What the map actually draws when the ties are asked for (#1160): the strongest across the whole
/// map while the switch is on, and the pinned file's own however it is set.
///
/// The cords are chosen here and stroked in a `Canvas`, so this is the seam every claim about what
/// is on the frame can be made at — including the one the ticket states absolutely: turning ties
/// off leaves no trace.
@Suite("Atlas — the cords the map draws")
struct AtlasTieCordTests {
    static let ground = CGSize(width: 800, height: 600)

    static let tiles = (1 ... 12).map(tile)

    /// Spread over the ground in four columns, so no two roofs project too close together to be
    /// drawn, and at twelve different heights so nothing here rests on two boxes standing level.
    static func tile(_ index: Int) -> AtlasTile {
        let column = CGFloat((index - 1) % 4)
        let row = CGFloat((index - 1) / 4)
        return AtlasTile(
            path: "root/f\(index).swift",
            rect: CGRect(x: column * 200, y: row * 200, width: 180, height: 180),
            band: .middling,
            height: CGFloat(index) * 4,
        )
    }

    static func projection(relief: Double = 0) -> AtlasProjection {
        AtlasProjection(
            of: AtlasPlan(extent: ground, tiles: tiles),
            through: AtlasCamera(relief: relief, over: ground),
        )
    }

    static func tie(_ first: Int, _ second: Int, _ strength: Double) -> AtlasCoupling {
        AtlasCoupling(
            first: "root/f\(first).swift", second: "root/f\(second).swift", strength: strength,
        )
    }

    static let couplings = [tie(1, 2, 0.9), tie(3, 4, 0.7), tie(5, 6, 0.5), tie(1, 7, 0.3)]

    static func cords(
        isOn: Bool,
        pinned: String? = nil,
        relief: Double = 0,
    )
        -> [AtlasCords.Cord] {
        AtlasCords(
            of: AtlasTies(couplings: couplings, isOn: isOn),
            pinned: pinned,
            through: projection(relief: relief),
        ).cords
    }

    /// **Turning ties off leaves no trace on the frame.** Asserted where the frame is decided
    /// rather than by looking at a render: a `Canvas` handed nothing to stroke draws nothing, and
    /// this is what says it is handed nothing.
    @Test
    func `with the switch off and no file pinned, nothing is drawn`() {
        #expect(Self.cords(isOn: false).isEmpty)
    }

    /// A filter draws only the strongest ties across the whole map — every one of them, and no
    /// other.
    @Test
    func `the switch draws the strongest ties across the map`() {
        #expect(Self.cords(isOn: true).count == Self.couplings.count)
        #expect(Self.cords(isOn: true).map(\.weight).allSatisfy { $0 == .acrossTheMap })
    }

    /// Pinning a file draws its own ties whatever the switch is set to — the reader pointed at a
    /// file and asked what it changes with, which is a question the switch does not answer.
    @Test
    func `a pinned file draws its own ties with the switch off`() {
        let cords = Self.cords(isOn: false, pinned: "root/f1.swift")
        #expect(cords.count == 2)
        #expect(cords.allSatisfy { $0.weight == .ofThePinnedFile })
    }

    /// One pair, one cord, at the WEIGHT the reader asked for: a tie that is both in the strongest
    /// across the map and in the pinned file's own is drawn once, as the pinned file's — a second
    /// stroke laid over the first is the defect, and the fainter of the two is the one to lose.
    @Test
    func `a tie the pinned file owns is not drawn twice`() {
        let cords = Self.cords(isOn: true, pinned: "root/f1.swift")
        #expect(cords.count == Self.couplings.count)
        #expect(cords.filter { $0.weight == .ofThePinnedFile }.count == 2)
        #expect(Set(cords.map(\.coupling.pair)).count == cords.count)
    }

    /// The pinned file's own are the ones the reader is reading, so they are the heavier: a cord
    /// answering a question just asked cannot be drawn as faintly as the hundred and fifty-nine
    /// the map was already carrying.
    @Test
    func `the pinned file's cords are drawn heavier than the map's`() {
        #expect(AtlasCordWeight.ofThePinnedFile.alpha > AtlasCordWeight.acrossTheMap.alpha)
        #expect(AtlasCordWeight.ofThePinnedFile.width > AtlasCordWeight.acrossTheMap.width)
    }

    /// Ties are drawn in BOTH views. Nothing here decides which — the cords come off the same
    /// projection the surface was handed — and this is the claim that says the drawing is not
    /// quietly gated on one of the two cameras.
    @Test(arguments: [0.0, 1.0])
    func `the cords are drawn at either end of the camera`(_ relief: Double) {
        #expect(!Self.cords(isOn: true, relief: relief).isEmpty)
    }

    /// A tie to a file that is not on the drawn map has no box to end on. The case a filter makes:
    /// hiding test files takes tiles off the plan, and a cord to one of them would run off to
    /// wherever a missing rectangle would have been.
    @Test
    func `a tie to a file the map is not drawing draws nothing`() {
        let cords = AtlasCords(
            of: AtlasTies(couplings: [Self.tie(1, 99, 0.9)], isOn: true),
            pinned: nil,
            through: Self.projection(),
        )
        #expect(cords.cords.isEmpty)
    }
}
