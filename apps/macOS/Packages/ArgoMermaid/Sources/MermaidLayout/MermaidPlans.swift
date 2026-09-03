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
/// Laid out from any thread since ADR-0030: the whole-document measure pass reaches a diagram
/// through here for the height of the row holding it, off the main actor and in parallel. Nothing
/// in a layout was ever the main actor's — it asks `ProseMetrics` for a label's width and does
/// arithmetic with the answer — so the annotation went with the store it guarded (`ProseStore`).
package enum MermaidPlans {
    private static let plans = ProseStore<MermaidPlan>()

    package static func of(_ diagram: MermaidDiagram) -> MermaidPlan {
        plans.reading(of: diagram.source) { _ in diagram.laid }
    }
}
