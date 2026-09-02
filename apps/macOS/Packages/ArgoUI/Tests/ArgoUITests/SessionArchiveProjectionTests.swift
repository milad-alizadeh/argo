import ArgoDesign
@testable import ArgoUI
import Testing

/// One gesture, one set of words. The menu bar and the Roster row reached it through two literals
/// that had already drifted apart in case (#800), so the wording is asserted here.
struct SessionArchiveProjectionTests {
    @Test
    func `archiving and putting back are Title Case, as menu items are`() {
        #expect(SessionArchiveProjection.title(isArchived: false) == "Archive Session")
        #expect(SessionArchiveProjection.title(isArchived: true) == "Put Back on the Roster")
    }

    /// The item is disabled with nothing selected, but still drawn — a menu with a blank line in it
    /// reads as broken rather than as inactive.
    @Test
    func `the disabled item reads as the gesture it would perform`() {
        #expect(SessionArchiveProjection.fallbackTitle == "Archive Session")
    }

    @Test
    func `the symbol turns around with the verb`() {
        #expect(SessionArchiveProjection.symbol(isArchived: false) == ArgoSymbol.archive)
        #expect(SessionArchiveProjection.symbol(isArchived: true) == ArgoSymbol.unarchive)
    }
}
