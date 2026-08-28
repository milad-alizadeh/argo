import Foundation

extension WorkItemDraft {
    /// A new ticket as GitHub's create endpoint takes it. `parent` is not here: GitHub files a
    /// ticket and parents it in two separate acts, so the draft's parent is applied afterwards.
    var fields: [String: Any] {
        var filed: [String: Any] = ["title": title]
        if let body {
            filed["body"] = body
        }
        if let type {
            filed["type"] = type
        }
        return filed
    }
}
