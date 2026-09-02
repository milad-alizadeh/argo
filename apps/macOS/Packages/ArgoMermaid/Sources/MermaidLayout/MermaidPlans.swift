import Foundation
import ProseText

/// A diagram laid out, kept so it is laid out once.
///
/// The renderer AND the overview lane both come here, so their geometry is one layout rather than
/// two implementations that happen to agree — which is what makes their heights match by
/// construction (#860). `ProseReading.plan(of:)` forwards to this, so the feed's other readings and
/// this one are still one store apiece rather than two behind one name.
///
/// Keyed on the source and nothing else, because a diagram is as big as the thing it draws: one too
/// wide for the column is scrolled rather than reflowed, so there is no second width for a second
/// layout to answer at (#861).
@MainActor
package enum MermaidPlans {
    private static var plans = ProseCache<MermaidPlan>()

    package static func of(_ diagram: MermaidDiagram) -> MermaidPlan {
        plans.reading(of: diagram.source) { _ in diagram.laid }
    }
}
