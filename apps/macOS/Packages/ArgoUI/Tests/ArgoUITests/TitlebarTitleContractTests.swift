@testable import ArgoUI
import Testing

/// The two contract values the centred Session title is built from (#691), now that `TitlebarTitle`
/// draws them (#692). They still need a suite of their own: the `Mirror` completeness guard reaches
/// colour groups only, never a static role, and the share is a number no screenshot can measure.
@Suite("Titlebar title contract")
struct TitlebarTitleContractTests {
    @Test
    func `a window title outweighs a roster row without outgrowing it`() {
        #expect(ArgoTypography.windowTitle.size == ArgoTypography.rowTitle.size)
        #expect(ArgoTypography.windowTitle.weight != ArgoTypography.rowTitle.weight)
    }

    /// Named, not inherited — so this fails if the role is left to follow the platform's rung.
    @Test
    func `a window title is set at the weight the design froze`() {
        #expect(ArgoTypography.windowTitle.weight == .semibold)
    }

    @Test
    func `a window title is set in the interface sans, like every other word`() {
        #expect(ArgoTypography.windowTitle.typeface == .interface)
    }

    /// `ContractSpecimen` draws `all`, so a role missing from it ships without being looked at.
    @Test
    func `the window-title role reaches the specimen`() {
        #expect(ArgoTypography.all.map(\.name).contains("windowTitle"))
    }

    /// The specimen draws an unwired role as unjudged, which is what stops an unset role reading as
    /// shipped. `TitlebarTitle` sets this one now, so the note has to go with it — a shipped role
    /// left on that list is a rendering the specimen goes on disclaiming.
    @Test
    func `the window-title role is no longer disclaimed, because something draws it`() {
        #expect(ArgoTypography.unwired["windowTitle"] == nil)
    }

    /// The share is what keeps a CENTRED title clear of the scope vessel and the rooms capsule,
    /// pinned to opposite edges. At a half or more it reaches an edge however they are sized.
    @Test
    func `a centred title may not claim half the pane it is centred on`() {
        #expect(ArgoLayout.titlebarTitleMaximumShare < 0.5)
        #expect(ArgoLayout.titlebarTitleMaximumShare > 0)
    }

    /// With no surface setting it, a test is the only thing keeping the number the design's own.
    @Test
    func `the title's share is the one the design settled on`() {
        #expect(ArgoLayout.titlebarTitleMaximumShare == 0.46)
    }
}
