/// A run of pictures, read as one row.
///
/// The same fold as the survey's and the collapsed run's, over the one kind of result that gets
/// worse the smaller it is drawn. Six screenshots as six filename rows say only that six reads
/// happened; six thumbnails say what the agent was looking at, which is the entire question a
/// reader has about a turn that rendered something.
///
/// A run of ONE is still a gallery, and that is the difference from the survey fold: `Read 1` loses
/// an address and saves nothing, but one thumbnail is a picture where there was a filename. The
/// treatment does not change with the count.
package struct FeedGallery: Equatable, Sendable {
    /// Who put these pictures in the feed. The treatment does not change with it — one treatment
    /// for a picture in the feed, whoever put it there (#733) — but what the row IS does: a run of
    /// pasted pictures is still the reader asking, and the Turn it opened is read off that
    /// (`FeedRowKind`).
    package enum Origin: Equatable, Sendable {
        /// Pictures a call came back with.
        case produced
        /// Pictures somebody pasted into prompts, which held no words of their own.
        case pasted
    }

    package let shots: [FeedShot]
    package let origin: Origin

    /// What a screen reader hears in place of the pictures it cannot show.
    package var spoken: String {
        shots.count == 1 ? "Showed 1 image" : "Showed \(shots.count) images"
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    ///
    /// The origin is defaulted because a gallery is a call's until a fold says otherwise, and the
    /// pasted run is the one caller that has to say so.
    package init(shots: [FeedShot], origin: Origin = .produced) {
        self.shots = shots
        self.origin = origin
    }
}
