import Foundation

/// Where an Account's grant is kept, keyed by the Account and by nothing else.
///
/// A protocol rather than the keychain directly because the keychain is the one dependency here
/// that a `swift test` run genuinely cannot reach: an unsigned test binary has no stable keychain
/// access group, so a real `SecItem` call either prompts a human or fails on the CI runner. The
/// round-trip against the real keychain is verified by hand and recorded on the PR; everything
/// *above* this seam is verified by the suite.
public protocol AccountGrantStore: Sendable {
    func store(_ grant: AccountGrant, for accountID: String) async throws
    func grant(for accountID: String) async throws -> AccountGrant?
    func removeGrant(for accountID: String) async throws
}
