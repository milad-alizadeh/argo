import Foundation

/// What a repeating read is currently pointed at, by the parts of it that can be compared.
///
/// Shared by the poll and the socket, because both answer the same question on every `point`: is
/// this the Binding I am already reading through? Two copies would be two chances to disagree about
/// what "unchanged" means, and one of them would keep reading a scope nobody asked for.
struct PortPointing: Equatable {
    let binding: ProjectBinding
    let projectID: String
    /// The token, because re-authorizing an Account leaves the Binding identical and replaces the
    /// grant — and a read that treated that as unchanged would run for the rest of the launch on a
    /// token the provider has stopped taking.
    let accessToken: String

    init(binding: ResolvedBinding, projectID: String) {
        self.binding = binding.binding
        self.projectID = projectID
        self.accessToken = binding.grant.accessToken
    }
}
