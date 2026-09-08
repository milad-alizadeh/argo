import AtlasLayout

/// What the city standing on the GPU was built from, and the one place that decides when it is
/// built again (#1598).
///
/// The city is a function of the plan and the pigments and of nothing else. A camera drag changes
/// neither: it writes an orientation into a binding, SwiftUI runs `AtlasView`'s body, and
/// `AtlasSurface` is handed the same plan and the same pigments as the frame before. Building the
/// city from them again is two faces per folder, one decal per file and one box per file — over
/// 6000 structs and three intermediate arrays for this repository — followed by a copy of the lot
/// into the GPU. All of it once per drag frame, on the main actor, for a picture that differs only
/// in where the reader is standing.
///
/// So the answer to "the reader turned the map" is nothing at all, and the comparison that says so
/// is the whole of this type.
///
/// A reference rather than a value, because what it holds outlives a frame and the one thing that
/// does too is `AtlasSurface`'s coordinator, which is a class.
final class AtlasCityCache {
    private var plan: AtlasPlan?
    private var pigments: AtlasPigments?

    /// The city to hand the renderer, or NOTHING where neither the plan nor the pigments have
    /// moved since the last ask.
    ///
    /// Nothing rather than the city built before, because the renderer is already holding that
    /// one: handing it back would be the copy into the instance buffer this exists to remove.
    func rebuilt(of plan: AtlasPlan, in pigments: AtlasPigments) -> AtlasCity? {
        guard self.plan != plan || self.pigments != pigments else { return nil }
        self.plan = plan
        self.pigments = pigments
        return AtlasVolumes.city(of: plan, in: pigments)
    }
}
