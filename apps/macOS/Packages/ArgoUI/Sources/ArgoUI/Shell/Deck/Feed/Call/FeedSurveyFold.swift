/// Where a run of looking starts and, more importantly, where it stops. The run breaks at every
/// loud row, so no fold ever reaches across a mutation.
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

    /// Two runs of looking that ended up next to each other, read as one.
    ///
    /// This pass runs over the whole stream, and every pass after it takes rows away: a Turn's card
    /// of work swallows the loud calls that had separated two runs of looking, and leaves the two
    /// standing one under the other. Nothing separates them any more, so nothing should draw them
    /// apart — three lines reading `Ran 3`, `Ran 2`, `Ran 3` are one stretch of looking that the
    /// reader has to add up by hand.
    ///
    /// DIRECTLY adjacent only. A sentence between two runs is the agent saying why the second one
    /// happened, and a fold that reached across it would take the first run's row away from the
    /// place the Turn wrote it.
    static func rejoined(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        contents.reduce(into: []) { rows, content in
            guard case let .survey(survey) = content, let previous = rows.last,
                  case let .survey(before) = previous
            else { return rows.append(content) }
            rows[rows.index(before: rows.endIndex)] = .survey(
                FeedSurvey(calls: before.calls + survey.calls),
            )
        }
    }

    /// A run of one is not a fold: `Read 1` loses the only address the row had and saves no room.
    private static func surveyed(_ run: [FeedCall]) -> [FeedRow.Content] {
        run.count > 1 ? [.survey(FeedSurvey(calls: run))] : run.map(FeedRow.Content.call)
    }

    /// A call that only looked, that the record did not answer with a failure, and that did not
    /// come back holding a picture.
    ///
    /// A failed read is loud: a count saying three reads happened would report that everything
    /// went fine.
    ///
    /// `onlyLooks` is true for `.read`, so a `Read` of a PNG would otherwise disappear into
    /// `Read 6`. Named here rather than left to the pass order, since the gallery fold runs after
    /// this one.
    ///
    /// Broken on `carriesMedia` and not on the gallery's own `showsMedia`, which is the stricter of
    /// the two: a call that came back with a picture AND a page of output belongs to neither fold.
    private static func quiet(_ content: FeedRow.Content) -> FeedCall? {
        guard case let .call(call) = content, call.onlyLooks, !call.ending.hasFailed,
              !call.carriesMedia
        else { return nil }
        return call
    }
}
