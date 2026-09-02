/// The one pass in the projection that is about the feed as a WHOLE rather than about a row, and
/// so the one that could ask every path in it about every other one.
extension FeedProjection {
    /// Two files of the same name take the shortest parent that tells them apart — the roster's
    /// rule for two workspaces, shared (#419). Computed over the WHOLE feed rather than per row,
    /// because whether a name is ambiguous is a fact about the feed it sits in, not about the file.
    ///
    /// The paths it looked at come back beside the contents, because "cost grows with the record
    /// and not the square of it" is a COUNT and never a duration (ADR-0028 Rule 8). Per call
    /// rather than tallied on a static, which every suite projecting a reading beside
    /// `FeedScaleTests` would share.
    static func toldApart(_ contents: [FeedRow.Content]) -> Labelling {
        let labelling = DistinguishingLabel.labelling(contents.map(path(in:)))
        return Labelling(
            contents: zip(contents, labelling.labels).map { qualified($0, as: $1) },
            looks: labelling.looks,
        )
    }

    /// What the pass produced, and what it cost in paths looked at.
    struct Labelling {
        let contents: [FeedRow.Content]
        let looks: Int
    }

    private static func path(in content: FeedRow.Content) -> String? {
        guard case let .call(call) = content,
              case let .file(file) = call.subject else { return nil }
        return file.path
    }

    private static func qualified(_ content: FeedRow.Content, as label: String?) -> FeedRow
        .Content {
        guard case let .call(call) = content, case let .file(file) = call.subject, let label
        else { return content }
        return .call(call.naming(file.qualified(as: label)))
    }
}
