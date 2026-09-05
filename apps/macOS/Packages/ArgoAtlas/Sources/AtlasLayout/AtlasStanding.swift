/// How much of the map is standing up: how much of the third dimension is left, and how far the
/// boxes have come out of their plates (#1150, #1421).
///
/// The two scalars `AtlasView` animates, and the only two — held together because that is what
/// they are. Every other number the map is drawn from is a fact about the repository or a camera
/// the reader is driving live; these are the pair a `withAnimation` moves between two values, and
/// a reader who flips the map mid-rise is owed one city doing both rather than a flip that
/// cancels a climb.
public struct AtlasStanding: Equatable, Sendable {
    /// 1 the city, 0 the treemap, and every value between them a camera of its own. Clamped on the
    /// way in, so nothing downstream has to ask whether it holds a number outside the two ends.
    public let relief: Double

    /// How far the city has climbed out of its plates: 0 every box flat, 1 every box at its
    /// measured height. The STAGGER that opens the city from the middle of the plan outwards is
    /// not in here — one number is the whole clock, and where a box sits decides its own share of
    /// it (`AtlasRise`).
    public let rise: Double

    public init(relief: Double, rise: Double = 1) {
        self.relief = min(1, max(0, relief))
        self.rise = min(1, max(0, rise))
    }

    /// The city, settled. What every still, every preview and every specimen of the map wants:
    /// only a room that has just measured a Project has a rise to run.
    public static let city = AtlasStanding(relief: 1)

    /// The same tiling seen straight down, settled. The rise is invisible at this end — a treemap
    /// shows no heights to climb — and it is 1 rather than 0 so that nothing reads this as a map
    /// waiting to stand up.
    public static let flat = AtlasStanding(relief: 0)
}
