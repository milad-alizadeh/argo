import ArgoEngine

/// One picture a call produced, as the feed shows it.
///
/// A shot carries its own address rather than borrowing the row's: a gallery is a run of SEVERAL
/// calls drawn as one row, so the row has no single file to name.
struct FeedShot: Equatable, Sendable {
    /// The short address, with the parent that tells two same-named files apart where needed.
    let name: String
    /// The whole path, which is what the lightbox says.
    let address: String
    let media: MediaEvidence
    /// Read off the file's signature, which is the only reading cheap enough: the projection
    /// builds every shot again on every body pass, so a decode here is one per picture per pass
    /// (ADR-0028 Rule 3).
    let provenance: MediaProvenance

    init(name: String, address: String, media: MediaEvidence) {
        self.name = name
        self.address = address
        self.media = media
        self.provenance = media.provenance
    }

    /// Whether clicking this opens anything — a shot with no picture is not a control.
    var isOpenable: Bool {
        provenance.showsPicture
    }
}

extension FeedShot {
    /// What a picture pasted into a prompt is called. It has no path to borrow one from — the CLI
    /// moved the bytes into the record and named no file — so it says what it IS (#733).
    static let pastedCaption = "Pasted image"

    static func pasted(_ media: MediaEvidence) -> FeedShot {
        FeedShot(name: pastedCaption, address: pastedCaption, media: media)
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

    /// Whether this call is a picture that worked, and nothing else — which makes it a gallery's
    /// rather than a line's.
    ///
    /// ALL of the evidence, not any of it: a collapsed run that produced a picture once and a page
    /// of output the next time would have its output dropped. And never a failure, since a
    /// thumbnail carries no failure ink.
    var showsMedia: Bool {
        guard !evidence.isEmpty, !ending.hasFailed else { return false }
        return evidence.allSatisfy(\.isMedia)
    }

    /// Whether this call came back holding a picture AT ALL — the weaker question, and the one the
    /// survey's break rule asks: a call carrying a picture never disappears into a line of counts.
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
