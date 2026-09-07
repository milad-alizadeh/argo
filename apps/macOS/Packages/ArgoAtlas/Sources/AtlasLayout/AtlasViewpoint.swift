/// Where the reader is looking at the map from: how much of it is standing up, which way it is
/// turned, and which folder the camera is seated onto (#1150, #1152, #1490).
///
/// The three readings `AtlasProjection` is solved from, held together because that is what they
/// are: none of them moves without the projection being solved again (#1516).
///
/// The plan is NOT one of them. A viewpoint is a camera, and `folder` seats it onto a plate
/// without re-tiling anything (#1490).
public struct AtlasViewpoint: Equatable, Sendable {
    /// How much of the map is standing up. `var`, and the only `var` here, because it is the pair
    /// `AtlasView.animatableData` moves: a `withAnimation` between two viewpoints drives this and
    /// nothing else.
    public var standing: AtlasStanding

    /// The city's own turn and tilt. Driven live, one drag or key press at a time, which is why it
    /// is not animated alongside `standing`.
    public let orientation: AtlasOrientation

    /// The folder the reader has descended into, or nothing for the whole repository. It seats the
    /// fit onto that folder's plate and changes no tiling.
    public let folder: String?

    /// Where the camera ACTUALLY is, while it is somewhere `folder` does not name (#1423).
    ///
    /// `var` and the second thing `AtlasView.animatableData` moves. Nothing for a camera at rest,
    /// which is every still and every caller that has not flown anywhere — then `folder` names the
    /// seat and this stays out of the way.
    ///
    /// Two values for one camera looks like two truths and is not: `folder` is where the READER is
    /// standing, which the rail and the trail beside the map also read, and this is where the
    /// picture has got to on its way there. They differ for the length of one flight and agree
    /// either side of it, which is the same distinction a descent already draws between a click
    /// being answered in words and the same click being answered in pixels.
    public var seat: AtlasSeat?

    public init(
        standing: AtlasStanding,
        orientation: AtlasOrientation = .opening,
        standingIn folder: String? = nil,
        seat: AtlasSeat? = nil,
    ) {
        self.standing = standing
        self.orientation = orientation
        self.folder = folder
        self.seat = seat
    }

    /// The settled city, from the opening view, over the whole repository. What every still, every
    /// preview and every specimen of the map wants.
    public static let city = AtlasViewpoint(standing: .city)

    /// The same tiling seen straight down. It keeps the opening orientation rather than dropping
    /// it: `AtlasCamera` tweens the yaw and tilt out at a `relief` of 0, so this is the value a
    /// caller raising `relief` again comes back to.
    public static let flat = AtlasViewpoint(standing: .flat)
}
