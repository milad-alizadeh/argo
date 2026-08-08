/// Where a run of pictures starts and where it stops.
///
/// The third pass over the feed's contents, and the LAST of them: it runs after the survey has
/// already counted the looking, so what reaches it is a stream in which no picture is hiding inside
/// a count — `FeedCall.showsMedia` is the case the survey's break rule gained, and this fold and
/// that rule read the same property so the two can never disagree about which calls are pictures.
///
/// The run breaks at the first thing that is not a picture, exactly as the survey's does. A
/// paragraph between two screenshots is the agent saying what the first one showed, and a gallery
/// that reached across it would put the answer inside the evidence.
enum FeedGalleryFold {
    static func galleried(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var rows: [FeedRow.Content] = []
        var run: [FeedShot] = []
        for content in contents {
            let shots = shots(in: content)
            guard shots.isEmpty else {
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
