import Foundation

/// Whether a value standing where a model id goes NAMES a model (#1223).
///
/// Not a list of models, and it must never become one: #558's rule is that an id Argo's readable
/// table has never heard of is exactly the id a newer CLI knows, so only the value's SHAPE can be
/// judged here. Two shapes name nothing: a blank value, and `<something>` — the angle brackets are
/// how a CLI writes a placeholder. `claude` 2.1.257 puts `<synthetic>` in the field on a record it
/// composed itself rather than got from a provider, beside `"isApiErrorMessage": true`.
enum ModelID {
    /// The id the value names, or `nil` where it names none. Verbatim on the way through: the
    /// blanks are judged on a trimmed copy, but what comes back is what went in (#558).
    static func named(in value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        guard !(trimmed.hasPrefix("<") && trimmed.hasSuffix(">")) else { return nil }
        return value
    }
}
