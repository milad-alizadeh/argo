/// Where a run of pictures starts and where it stops.
///
/// The third and LAST pass over the feed's contents: it runs after the survey has counted the
/// looking, so no picture is hiding inside a count. The survey breaks on the wider `carriesMedia`
/// and this fold gathers on the stricter `showsMedia`, so the two can never disagree in the
/// direction that loses a picture.
///
/// The run breaks at the first thing that is not a picture, exactly as the survey's does.
enum FeedGalleryFold {
    static func galleried(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var rows: [FeedRow.Content] = []
        var run: [FeedShot] = []
        for content in contents {
            let shots = shots(in: content)
            if !shots.isEmpty {
                run.append(contentsOf: shots)
                continue
            }
            rows.append(contentsOf: gathered(run))
            run = []
            rows.append(content)
        }
        return rows + gathered(run)
    }

    private static func gathered(_ run: [FeedShot]) -> [FeedRow.Content] {
        run.isEmpty ? [] : [.gallery(FeedGallery(shots: run))]
    }

    /// The pictures a row contributes to a run, or none — which is also what says the run ends
    /// here. A collapsed run of three renders of one file contributes all three.
    private static func shots(in content: FeedRow.Content) -> [FeedShot] {
        guard case let .call(call) = content, call.showsMedia else { return [] }
        return call.shots
    }
}
