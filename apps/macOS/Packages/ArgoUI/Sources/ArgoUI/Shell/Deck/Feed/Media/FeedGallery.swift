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
struct FeedGallery: Equatable, Sendable {
    let shots: [FeedShot]

    /// What a screen reader hears in place of the pictures it cannot show.
    var spoken: String {
        shots.count == 1 ? "Showed 1 image" : "Showed \(shots.count) images"
    }
}
