import Foundation

/// One of Argo's two adapter ports — the kind of external truth a Binding reads through
/// (ADR-0014, ADR-0018).
///
/// It appears at the Account level only to say what a removal would orphan: a Binding is named by
/// the Project it belongs to and the port it fills, and #B is what creates them.
public enum AccountPort: String, Sendable, Codable, CaseIterable {
    case workItem
    case codeHost
}
