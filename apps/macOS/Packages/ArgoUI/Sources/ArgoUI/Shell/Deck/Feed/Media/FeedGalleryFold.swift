/// Where a run of pictures starts and where it stops.
///
/// The third and LAST pass over the feed's contents: it runs after the survey has counted the
/// looking, so no picture is hiding inside a count. The survey breaks on the wider `carriesMedia`
/// and this fold gathers on the stricter `showsMedia`, so the two can never disagree in the
/// direction that loses a picture.
///
/// **A row joins a run when pictures are ALL it holds.** That one rule is the whole behavior, and
/// it reaches across the row KINDS that carry pictures rather than across `.call` alone (#1252):
/// a picture pasted into a prompt is a `.prompt` row, so a run of them drew one thumbnail per row
/// down a column instead of one grid. Everything else breaks the run, and the two that look like
/// near misses break it for the same reason as each other — words in a prompt are content, and a
/// call that came back with a picture AND a page of output is content too, so neither row is
/// pictures alone and no fold may swallow the half that is not a picture.
///
/// A run also breaks where its ORIGIN changes, so a gallery is never half pasted and half
/// produced. That keeps the Turn a pasted run opened exactly where the first of those prompts
/// stood: the work fold reads its Turn boundaries off `isPrompt` over these same rows, and a
/// gallery that had swallowed a call ahead of the prompt would move the boundary up the reading.
enum FeedGalleryFold {
    static func galleried(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var rows: [FeedRow.Content] = []
        var run: [FeedShot] = []
        var origin = FeedGallery.Origin.produced
        for content in contents {
            guard let held = pictures(in: content) else {
                rows.append(contentsOf: gathered(run, from: origin))
                run = []
                rows.append(content)
                continue
            }
            if held.origin != origin {
                rows.append(contentsOf: gathered(run, from: origin))
                run = []
                origin = held.origin
            }
            run.append(contentsOf: held.shots)
        }
        return rows + gathered(run, from: origin)
    }

    private static func gathered(_ run: [FeedShot], from origin: FeedGallery.Origin)
        -> [FeedRow.Content] {
        run.isEmpty ? [] : [.gallery(FeedGallery(shots: run, origin: origin))]
    }

    /// The pictures a row contributes to a run and whose they are, or none — which is also what
    /// says the run ends here. A collapsed run of three renders of one file contributes all three.
    ///
    /// A row holding no picture at all contributes none whichever kind it is, so a prompt of
    /// nothing keeps its own row rather than being folded away into a gallery of nothing.
    private static func pictures(in content: FeedRow.Content)
        -> (shots: [FeedShot], origin: FeedGallery.Origin)? {
        let held: (shots: [FeedShot], origin: FeedGallery.Origin)? = switch content {
        case let .call(call) where call.showsMedia: (call.shots, .produced)
        case let .prompt(text, shots) where text.isEmpty: (shots, .pasted)
        default: nil
        }
        return held.flatMap { $0.shots.isEmpty ? nil : $0 }
    }
}
