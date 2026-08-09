import ArgoEngine

/// One picture a call produced, as the feed shows it.
///
/// A shot carries its own address rather than borrowing the row's, because a gallery is a run of
/// SEVERAL calls drawn as one row: the row has no single file to name, so each shot names its own
/// or nothing in the feed does.
struct FeedShot: Equatable, Sendable {
    /// The filename, with the parent that tells two same-named files apart where the feed needed
    /// one — the same short address every other row in the feed uses.
    let name: String
    /// The whole path, which is what the lightbox says when the picture is the only thing on
    /// screen and the filename above it is no longer beside anything.
    let address: String
    let media: MediaEvidence
    /// Where the picture came from, spelled the panel's way. Answering it costs a decode — it is
    /// partly the question of whether the bytes ARE a picture — so it is settled once, here, rather
    /// than recomputed by every surface and every layout pass that asks.
    let provenance: MediaProvenance

    init(name: String, address: String, media: MediaEvidence) {
        self.name = name
        self.address = address
        self.media = media
        self.provenance = media.provenance
    }

    /// Whether clicking this opens anything. A shot with no picture is not a control: there is
    /// nothing behind it, and a click that opens an empty lightbox is worse than no click at all.
    var isOpenable: Bool {
        provenance.showsPicture
    }
}

extension FeedCall {
    /// Every picture this line stands for, in the order the calls produced them.
    var shots: [FeedShot] {
        evidence.compactMap { result in
            guard case let .media(media) = result else { return nil }
            return FeedShot(name: subject.captioned, address: address.text, media: media)
        }
    }

    /// Whether this call is a picture that worked, and nothing else — which is what makes it a
    /// gallery's rather than a line's.
    ///
    /// ALL of the evidence, not any of it. A collapsed run that produced a picture once and a page
    /// of output the next time is still a call: routing it to the gallery would draw the picture
    /// and drop the output, and the one thing every fold in this feed guarantees is that nothing
    /// is lost.
    ///
    /// And never a failure, for the reason `FeedSurveyFold` never folds one: a failed call is the
    /// loudest thing in a run, and a thumbnail carries no failure ink. It stays a line, in the
    /// failure colour, with what went wrong behind it.
    var showsMedia: Bool {
        guard !evidence.isEmpty, !ending.hasFailed else { return false }
        return evidence.allSatisfy(\.isMedia)
    }

    /// Whether this call came back holding a picture AT ALL — which is the weaker question, and the
    /// one the survey's break rule asks.
    ///
    /// The two are deliberately different. A call that produced a picture and a page of output is
    /// not a gallery's, but it is not a count's either: folded into `Read 2` its picture leaves the
    /// feed entirely, and the rule is that a call carrying a picture never disappears into a line
    /// of counts. It stays its own row, with the panel that holds both halves.
    var carriesMedia: Bool {
        evidence.contains(where: \.isMedia)
    }
}

private extension ToolResult {
    var isMedia: Bool {
        guard case .media = self else { return false }
        return true
    }
}
