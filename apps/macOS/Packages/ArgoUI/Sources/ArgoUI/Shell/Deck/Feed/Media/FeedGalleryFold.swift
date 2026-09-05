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
/// produced. That is what puts the pasted run's Turn boundary exactly where the FIRST of those
/// prompts stood: the work fold reads its boundaries off `isPrompt` over these same rows, and a
/// gallery that had swallowed a call ahead of the prompt would move the boundary up the reading.
///
/// The boundaries the rows BEHIND it opened go with those rows, as every other fold's swallowed
/// rows take theirs. Six pictures pasted one after another are six prompt records and so six
/// Turns, and the reading now names one — which is what they are: the agent answered none of the
/// five, so five of those Turns hold nothing to be cut from, and a lane marking them marks
/// nothing six times.
enum FeedGalleryFold {
    static func galleried(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var rows: [FeedRow.Content] = []
        var run: FeedGallery?
        for content in contents {
            guard let held = pictures(in: content) else {
                rows.append(contentsOf: gathered(run))
                run = nil
                rows.append(content)
                continue
            }
            guard let open = run, open.origin == held.origin else {
                rows.append(contentsOf: gathered(run))
                run = held
                continue
            }
            run = FeedGallery(shots: open.shots + held.shots, origin: open.origin)
        }
        return rows + gathered(run)
    }

    private static func gathered(_ run: FeedGallery?) -> [FeedRow.Content] {
        run.map { [.gallery($0)] } ?? []
    }

    /// The gallery a row on its own would be, or none — which is also what says the run ends here.
    /// A collapsed run of three renders of one file contributes all three.
    ///
    /// A row holding no picture at all contributes none whichever kind it is, so a prompt of
    /// nothing keeps its own row rather than being folded away into a gallery of nothing.
    ///
    /// No `default`, for `FeedRow.Content.kind`'s reason: a twelfth kind that carries pictures
    /// fails this build rather than quietly ending every run it lands in.
    private static func pictures(in content: FeedRow.Content) -> FeedGallery? {
        let held: FeedGallery? = switch content {
        case let .call(call): call.showsMedia ? FeedGallery(shots: call.shots) : nil
        // Trimmed, not `isEmpty`: the CLI writes `[Image #3]` beside the pixels and the engine
        // shears the token plus at most ONE space off it (`HarnessRecord.shorn`), so a paste that
        // was two pictures, or one on a line of its own, leaves a space or a newline behind. A
        // prompt of whitespace is a prompt of no words, and reading it as content would stack the
        // very run this fold is for.
        case let .prompt(text, shots):
            text.trimmed.isEmpty ? FeedGallery(shots: shots, origin: .pasted) : nil
        case .message, .thought, .survey, .work, .gallery, .ask, .skillLoaded, .mark,
             .settledWait, .submitted, .delegationEnded, .unreadable: nil
        }
        return held.flatMap { $0.shots.isEmpty ? nil : $0 }
    }
}
