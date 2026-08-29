import AppKit
import SwiftUI

// The measuring controllers: one per `FeedRow.Content.Shape`, kept because a controller handed the
// tree it already holds diffs and one handed a different tree rebuilds. See `FeedRow.Content.Shape`
// for what that costs. The dictionary itself stays on the class — a stored property cannot live in
// an extension — and everything done with it lives here.

extension FeedTableCoordinator {
    /// Which shapes have a ruler of their own right now. The split is invisible from outside
    /// otherwise — a measure pass that quietly collapsed onto one controller would still land
    /// every row on the right height, and only cost twice as much (`FeedRowShapeTests`).
    var rulerShapes: Set<FeedRow.Content.Shape> {
        Set(rulers.keys)
    }

    /// The controller a row of this shape is measured in, made on first use.
    func ruler(for shape: FeedRow.Content.Shape) -> NSHostingController<AnyView> {
        if let known = rulers[shape] {
            return known
        }
        let made = NSHostingController(rootView: AnyView(EmptyView()))
        made.sizingOptions = []
        rulers[shape] = made
        return made
    }

    /// Every ruler emptied, at the READING boundary and never per row: clearing per row is what
    /// made every measure a full rebuild.
    ///
    /// What it surrenders is object-graph retention — the previous reading's rows and bindings,
    /// held in up to ten `AnyView`s. NOT running work: a probe of this path found a `.task` in a
    /// detached controller never ticks, since nothing here touches `.view` or displays it, and
    /// clearing `rootView` would not cancel one that had.
    func surrenderRulers() {
        rulers.values.forEach { $0.rootView = AnyView(EmptyView()) }
    }
}
