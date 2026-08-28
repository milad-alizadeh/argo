import Foundation

/// A ticket that does not exist yet.
///
/// `type` is here because Jira refuses a create without one; a provider that carries no types
/// ignores it rather than failing, which is what its being optional says.
public struct WorkItemDraft: Equatable, Sendable {
    public let title: String
    public let body: String?
    public let type: String?
    public let parent: Int?

    public init(title: String, body: String? = nil, type: String? = nil, parent: Int? = nil) {
        self.title = title
        self.body = body
        self.type = type
        self.parent = parent
    }
}
