/// Where a run of looking starts and, more importantly, where it stops.
///
/// The break rule is the whole point. A fold that reached across a mutation would put "Edited a
/// file, ran a command, read a file" behind one count and call it observation; breaking at every
/// loud row makes that mush structurally impossible rather than merely discouraged, and it welds a
/// run of reads to the paragraph directly beneath it — which is the evidence-then-conclusion
/// reading the feed exists to give.
enum FeedSurveyFold {
    static func folded(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var rows: [FeedRow.Content] = []
        var run: [FeedCall] = []
        for content in contents {
            if let quiet = quiet(content) {
                run.append(quiet)
                continue
            }
            rows.append(contentsOf: surveyed(run))
            run = []
            rows.append(content)
        }
        return rows + surveyed(run)
    }

    /// A run of one is not a fold. `Read 1` is the same line with the filename taken off it — it
    /// loses the only address the row had and saves no room at all.
    private static func surveyed(_ run: [FeedCall]) -> [FeedRow.Content] {
        run.count > 1 ? [.survey(FeedSurvey(calls: run))] : run.map(FeedRow.Content.call)
    }

    /// A call that only looked, that the record did not answer with a failure, and that did not
    /// come back holding a picture.
    ///
    /// A failed read is loud: it is the one thing in the run worth seeing, and a count saying three
    /// reads happened would be the fold reporting that everything went fine.
    ///
    /// A picture is loud for the opposite reason. `isQuiet` is true for `.read`, so a `Read` of a
    /// PNG is a read like any other to this rule and would disappear into `Read 6` — the one row
    /// in the run whose whole content is the thing a count cannot say. Named here rather than left
    /// to the pass order: the gallery fold runs after this one and reads the same property, so the
    /// precedence between the two folds is stated in one place and asserted from both sides.
    private static func quiet(_ content: FeedRow.Content) -> FeedCall? {
        guard case let .call(call) = content, call.kind.isQuiet, !call.ending.hasFailed,
              !call.showsMedia
        else { return nil }
        return call
    }
}
