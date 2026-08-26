import Foundation

/// The pass that turns every `#<N>` the roster derived into the words the code host holds, and
/// leaves each one where the next launch will find it (#745).
///
/// One read per ticket per launch, not per refresh: the annotation is a write-through of the
/// reading, so every read after the first is answered off disk. A ticket renamed while Argo is
/// running is therefore stale until the next launch — the alternative is a request per refresh, and
/// a refresh is what every keystroke on the roster amounts to.
public actor WorkItemTitleResolver {
    private let titles: GitHubWorkItemTitles
    private let annotations: SessionAnnotationStore
    /// What the host said about each number this launch, asked once. Held here rather than derived
    /// from the annotations, because `.absent` and "never asked" both read as no stored title.
    private var reads: [Int: WorkItemTitleRead] = [:]

    public init(titles: GitHubWorkItemTitles, annotations: SessionAnnotationStore) {
        self.titles = titles
        self.annotations = annotations
    }

    /// Resolve the Work Item behind each Session, keyed by chain id, and answer the annotations the
    /// roster should now be projected from.
    ///
    /// `binding` is the Project's Work Item port, already resolved: an unbound or broken one has no
    /// token to read through, and the caller does not reach here with it.
    @discardableResult
    public func resolve(
        links: [String: Int], through binding: ResolvedBinding,
    ) async
        -> SessionAnnotations {
        for number in Set(links.values) where reads[number] == nil {
            reads[number] = await titles.read(
                titleOf: number, in: binding.binding.scope, grant: binding.grant,
            )
        }
        var latest = await annotations.load()
        for (sessionID, number) in links {
            latest = await apply(reads[number], to: sessionID) ?? latest
        }
        return latest
    }

    /// One reading written, and `nil` for the one case that writes nothing: a host that did not
    /// answer leaves whatever Argo already held in place.
    private func apply(
        _ read: WorkItemTitleRead?, to sessionID: String,
    ) async
        -> SessionAnnotations? {
        switch read {
        case let .title(title): await annotations.setTicketTitle(title, sessionID: sessionID)
        case .absent: await annotations.setTicketTitle(nil, sessionID: sessionID)
        case .unreadable, nil: nil
        }
    }
}
