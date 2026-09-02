import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI

/// What the three visual-contract suites assert over: every appearance the contract ships, and the
/// contrast floor each of them has to clear.
///
/// Parameterising over `all` rather than writing against `graphite` is what makes the rules
/// relationships — separation, ordering, contrast — so a light appearance arrives already governed.
enum VisualContractFixture {
    static let palettes = ArgoPalette.all
    static let floor = ArgoPalette.TextRoles.contrastFloor
}
