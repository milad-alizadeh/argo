import Foundation

/// Whether a value naming a model is a MODEL ID at all (#1223).
///
/// Not a list of models, and it must never become one: #558's rule is that an id Argo's readable
/// table has never heard of is exactly the id a newer CLI knows, so the only thing that can be
/// judged here is the value's SHAPE. Two shapes are not ids:
///
/// - nothing at all — an empty or blank value names no model;
/// - `<something>` — the angle brackets are how a CLI writes a placeholder, and `<synthetic>` is
///   the one `claude` puts on a record it composed itself rather than got from a provider (an API
///   error, a rate-limit notice). It is the host saying NO model answered, in the field where a
///   model would go.
///
/// Argo took such a value as the Session's model, offered it in the composer's model picker, and
/// put it back on `--model` at every resume. No such model exists, so every turn then failed — and
/// a failed turn writes another synthetic record, so the Session could never read its way out.
public enum ModelID {
    /// `false` for a value that is a placeholder rather than an id. A caller reading a model off a
    /// record or a file drops the value on `false` and KEEPS what it already had: the last real
    /// reading is a truer answer than the host's word for having none.
    public static func isReal(_ id: String) -> Bool {
        let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return !(trimmed.hasPrefix("<") && trimmed.hasSuffix(">"))
    }
}
