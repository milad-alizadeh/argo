import AppKit

// The one place a row's height comes from, and the fork in it: a prose row is typeset by
// `FeedRowMeasure`, and every other row is laid out for real against the ruler. In front of both
// stands `FeedGeometry`, which is what lets a height outlive the table that took it (#858).

extension FeedTableCoordinator {
    /// A row's height, kept — see `geometry`.
    func measuredHeight(at index: Int, in table: NSTableView) -> CGFloat {
        let width = table.bounds.width
        guard let model, shown.indices.contains(index), width > 0 else {
            return Self.estimatedRowHeight
        }
        // The pass's facts once, then the row's own with the question. A height kept under either
        // is not an answer to this one, which is what lets the store outlive the table that filled
        // it (#858).
        geometry.settle(at: width, in: model.environment)
        let ground = FeedGeometry.Ground(at: index, of: model)
        if let known = geometry.height(under: ground) {
            return known
        }
        // Rounded UP to a whole point: a non-integral row height still blurs baselines on
        // current macOS, and up rather than to-nearest so text is never clipped by rounding.
        let height = Self.usableHeight(ceil(measure(at: index, of: model, atWidth: width)))
        geometry.record(height, under: ground)
        return height
    }

    /// The row measured, by whichever of the two paths can answer for it. The step above the row is
    /// added here rather than inside either: it is the cell's own padding, and the same number
    /// whatever the row draws (`FeedRow.step(to:from:)`).
    private func measure(
        at index: Int,
        of model: FeedTableModel,
        atWidth width: CGFloat,
    )
        -> CGFloat {
        let row = model.rows[index]
        let step = FeedRow.step(to: row, from: index > 0 ? model.rows[index - 1] : nil)
        if let typeset = FeedRowMeasure.height(
            of: row.content,
            chip: FeedCopy.drawsChip(of: model.rows, at: index),
            across: FeedRowMeasure.measure(atWidth: width),
        ) {
            noted(layout: false)
            return step + typeset
        }
        let ruler = ruler(for: row.content.shape)
        ruler.rootView = model.content(at: index)
        noted(layout: true)
        return ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }
}
