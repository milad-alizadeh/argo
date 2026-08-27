import Foundation

/// Which Binding a read goes through, and which Project it answers for.
///
/// The Project id travels with the Binding because health is keyed on both (#260): the same
/// Account bound by two Projects is two connections, and one of them can be failing.
public struct PortReadTarget: Sendable {
    public let binding: ResolvedBinding
    public let projectID: String

    public init(binding: ResolvedBinding, projectID: String) {
        self.binding = binding
        self.projectID = projectID
    }

    /// Named here so a caller asks the target rather than walking `binding.binding` at every site.
    var scope: String {
        binding.binding.scope
    }

    var accountID: String {
        binding.binding.accountID
    }

    var projectBinding: ProjectBinding {
        binding.binding
    }
}
