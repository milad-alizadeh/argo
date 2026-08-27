import Foundation

/// One page of a GitHub listing. Most endpoints serve a bare array; a few wrap the items in an
/// envelope, and this is what lets one paging walk read both.
protocol GitHubPage: Decodable {
    associatedtype Item
    var items: [Item] { get }
}

extension Array: GitHubPage where Element: Decodable {
    var items: [Element] {
        self
    }
}
