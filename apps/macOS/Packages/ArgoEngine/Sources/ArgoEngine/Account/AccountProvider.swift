import Foundation

/// A provider Argo can hold an identity with.
///
/// Not the same axis as `AccountPort`: this is *who issues the grant*, the port is *what kind of
/// truth is read through it*. GitHub issues one grant that can fill both ports; Linear issues one
/// that can fill only the Ticket port.
public enum AccountProvider: String, Sendable, Codable, CaseIterable {
    case github
    case linear
}
