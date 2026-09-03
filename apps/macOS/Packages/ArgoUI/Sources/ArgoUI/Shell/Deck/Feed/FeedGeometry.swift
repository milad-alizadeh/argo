import AppKit
import SwiftUI

/// The settled document for ONE reading, held above every view identity a switch destroys.
///
/// Which reading's document this is, is `FeedGeometries`', which holds one of these per
/// `FeedReading`.
///
/// It holds a whole document or nothing (`FeedSettledDocument`), and that is the entire correctness
/// of outliving the table: there is no invalidation to get right and no order to get right, because
/// the document carries the stamp it was measured against and a stamp that no longer describes the
/// reading is a document nobody may consume. `InstrumentDeckShell` draws each room in its own
/// `switch` arm, so leaving the Sessions room tears the table down — and coming back finds the
/// document still here rather than measuring every row again (#858).
///
/// What it is NOT any more is a per-row store answering `heightOfRow` on the spot. That was the
/// defect ADR-0030 names: a height worked out when a row scrolled into view is a document whose
/// total height keeps moving under the scroller and under the Minimap.
///
/// NOT `@Observable`. The document is written once per pass, and the deck learns that it landed
/// through `FeedTableHandle.isSettled` rather than by re-rendering on this.
@MainActor final class FeedGeometry {
    /// The reading at its width with every row's final height, or nothing at all while a pass is
    /// still to run. Never a half of one.
    private(set) var settled: FeedSettledDocument?

    /// Whether the deck may draw the reading. The one question every surface over this asks.
    var isSettled: Bool {
        settled != nil
    }

    var count: Int {
        settled?.count ?? 0
    }

    var isEmpty: Bool {
        settled?.count ?? 0 <= 0
    }

    /// What row `index` stands at, or `nil` where this document does not hold that row.
    func height(at index: Int) -> CGFloat? {
        settled?.height(at: index)
    }

    /// A document landed. The only way anything in here changes.
    func settle(_ document: FeedSettledDocument?) {
        settled = document
    }

    /// The document surrendered, because it is a document of a reading that is no longer being
    /// shown at a width that is no longer in force — a re-wrap. Its absence is what puts the deck
    /// back into its provisional state (`FeedVacancy.unread`).
    func surrender() {
        settled = nil
    }
}
