import AppKit

/// One Session's deck, kept for as long as the reader keeps coming back to it (ADR-0030, Rule 4).
///
/// Everything a reading is read THROUGH, held together because they are made together and dropped
/// together: the table and its scroller, the coordinator that draws them, the scroll authority the
/// minimap shares, and the folds the reader made. Leaving the deck hides the scroller; coming back
/// shows it, with the offset it was left at and the document it was drawn from still standing.
///
/// What is NOT here is the measured heights. They are `FeedGeometries`', held under a wider bound,
/// so an evicted Session re-opens over known geometry with no measure.
///
/// `@Observable` for the FOLDS alone. Everything else is written by the AppKit half and read back
/// through the handle, which is observable itself; a fold is written by a cell and has to reach
/// the SwiftUI pass that hands the table its next model.
@MainActor @Observable package final class KeptDeck {
    /// Which reading this deck is of. Fixed for its life: a deck is never re-pointed at another
    /// reading.
    @ObservationIgnored let reading: FeedReading
    @ObservationIgnored package let handle: FeedTableHandle
    @ObservationIgnored let coordinator: FeedTableCoordinator
    /// Held STRONGLY, because the coordinator holds it weakly: the deck outlives the view tree
    /// that put it on screen, and a room switch takes that tree down.
    @ObservationIgnored let scroller: NSScrollView

    /// Which prompts the reader has let out in this reading, or `nil` while they have folded
    /// nothing — which is what lets `FeedView.opensUnfolded` stand from the first frame.
    var folds: Set<FeedRow.ID>?

    /// Whether this deck has been evicted. Read by `FeedDeckStack`, which takes the scroller out of
    /// the view tree on its next update — an eviction is decided inside a SwiftUI pass, and the
    /// view tree is not that pass's to change.
    @ObservationIgnored private(set) var isRetired = false

    init(of reading: FeedReading, opening held: FeedRow.ID? = nil) {
        self.reading = reading
        let handle = FeedTableHandle(held: held)
        let coordinator = FeedTableCoordinator()
        self.scroller = coordinator.makeScrollView()
        coordinator.handle = handle
        handle.coordinator = coordinator
        self.handle = handle
        self.coordinator = coordinator
    }

    /// The deck a surface with nothing to switch between holds — a preview, a specimen, a
    /// `#Preview`, where the one reading has no Session behind it.
    package convenience init(opening held: FeedRow.ID? = nil) {
        self.init(of: .unattached, opening: held)
    }

    /// Evicted: the deck is dropped and the reading it held let go. The measure in flight goes with
    /// it — its answer is a document nothing will ever draw.
    func retire() {
        isRetired = true
        coordinator.retire()
    }
}
