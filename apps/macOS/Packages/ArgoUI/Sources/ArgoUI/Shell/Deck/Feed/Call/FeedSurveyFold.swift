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
