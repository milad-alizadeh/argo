import ArgoDesign
@testable import ArgoUI
import Testing

/// `bodyHeading` carries `windowTitle`'s tuple, so the shared sweeps over `all` cannot tell the two
/// roles apart and a suite of its own is what keeps them from being folded together.
@Suite("Body heading contract")
struct BodyHeadingContractTests {
    @Test
    func `a body heading is set at the tuple the design settled on`() {
        #expect(ArgoTypography.bodyHeading.typeface == .interface)
        #expect(ArgoTypography.bodyHeading.rung == .headline)
        #expect(ArgoTypography.bodyHeading.weight == .semibold)
    }

    /// The prose it introduces is `body`, at the same 13, so weight is all that separates them.
    @Test
    func `a body heading outweighs the prose under it without outgrowing it`() {
        #expect(ArgoTypography.bodyHeading.size == ArgoTypography.body.size)
        #expect(ArgoTypography.bodyHeading.weight != ArgoTypography.body.weight)
    }

    /// Fails the day either role is deleted in favour of the other.
    @Test
    func `a body heading is a second role carrying the window title's tuple`() {
        let names = ArgoTypography.all.map(\.name)

        #expect(names.contains("bodyHeading"))
        #expect(names.contains("windowTitle"))
        #expect(ArgoTypography.bodyHeading.rung == ArgoTypography.windowTitle.rung)
        #expect(ArgoTypography.bodyHeading.weight == ArgoTypography.windowTitle.weight)
    }

    /// The specimen draws an unwired role as unjudged. The ticket's Children section sets this one
    /// now (#814), so the disclaimer would be the lie instead.
    @Test
    func `a body heading is no longer disclaimed, because a surface draws it`() {
        #expect(ArgoTypography.unwired["bodyHeading"] == nil)
    }
}
