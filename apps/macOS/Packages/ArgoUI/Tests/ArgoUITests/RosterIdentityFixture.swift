@testable import ArgoUI

/// A roster of plain rows: each has retired nothing and none is archived, which is every roster
/// with no resume chain and no archive in it.
///
/// Here rather than as a literal conformance on `RosterIdentity` itself: the type is read by one
/// production caller, which hands it whole rows, and a shape that exists only for fixtures belongs
/// with the fixtures.
func roster(_ ids: String...) -> [RosterIdentity] {
    ids.map { RosterIdentity($0) }
}
