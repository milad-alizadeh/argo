extension FeedProjection {
    /// Two files of the same name take the shortest parent that tells them apart — the roster's
    /// rule for two workspaces, shared (#419). Computed over the WHOLE feed rather than per row,
    /// because whether a name is ambiguous is a fact about the feed it sits in, not about the file.
    ///
    /// The paths it looked at come back beside the contents: the count `FeedScaleTests` gates this
    /// pass on instead of a duration (ADR-0028 Rule 8).
    static func toldApart(_ contents: [FeedRow.Content])
        -> (contents: [FeedRow.Content], looks: Int) {
        let labelling = DistinguishingLabel.labelling(contents.map(path(in:)))
        return (zip(contents, labelling.labels).map { qualified($0, as: $1) }, labelling.looks)
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
