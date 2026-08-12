@testable import ArgoUI
import Testing

/// The two contract values the centred Session title will be built from (#691). Nothing draws them
/// yet, so these are the whole of what holds them to the design until `TitlebarTitle` lands — and
/// the `Mirror` completeness guard reaches colour groups only, never a static role.
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

    /// The specimen draws a kept role as unjudged, which is what stops an unset role reading as
    /// shipped. `design-system.md` requires the note; the contract suite checks it names a real
    /// role.
    @Test
    func `the window-title role says what it is still waiting on`() {
        #expect(ArgoTypography.unwired["windowTitle"] != nil)
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
