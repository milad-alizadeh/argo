import ArgoDesign
@testable import ArgoUI
import Testing

/// One gesture, two readings of it. The menu bar and the Roster row reached it through two
/// literals that had already drifted apart in case (#800), so both are asserted here — and they
/// now say deliberately different words, which is exactly why neither may drift again (#1257).
struct SessionArchiveProjectionTests {
    @Test
    func `archiving and putting back are Title Case, as menu items are`() {
        #expect(SessionArchiveProjection.menuTitle(isArchived: false) == "Archive Session")
        #expect(SessionArchiveProjection.menuTitle(isArchived: true) == "Put Back on the Roster")
    }

    @Test
    func `the row names the verb without naming what it acts on`() {
        #expect(SessionArchiveProjection.rowTitle(isArchived: false) == "Archive")
        #expect(SessionArchiveProjection.rowTitle(isArchived: true) == "Put Back")
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
