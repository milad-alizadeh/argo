import Foundation

/// What a repeating read is currently pointed at, by the parts of it that can be compared.
///
/// Shared by the poll and the socket, so both answer "is this the Binding I am already reading
/// through?" the same way.
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
