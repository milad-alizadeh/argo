import Foundation

/// What the READER has done to a reading, as one value: which prompts they have let out, and which
/// row the evidence panel is open on.
///
/// Both are facts about the same thing — a row's height beyond its own words — and both are read
/// per row by the measure pass (`FeedMeasureStamp.standing(at:)`). One value rather than two
/// fields, because a stamp is built on every pass the table applies and the list of what a height
/// depends on is a list somebody has to keep true; grouped, it is one name to follow.
///
/// A `FeedRow.ID` is a dense POSITION, so each of these ids is its own index — which is what lets
/// a fold change name the rows it owes a measurement without a walk (`FeedMeasureDelta`).
struct FeedReaderStanding: Equatable, Sendable {
    /// Which prompts the reader has let out. A prompt shows three lines folded and all of them not.
    var unfolded: Set<FeedRow.ID> = []
    /// The row the evidence panel is open on, which is what makes a survey list what it looked at.
    var open: FeedRow.ID?
}
