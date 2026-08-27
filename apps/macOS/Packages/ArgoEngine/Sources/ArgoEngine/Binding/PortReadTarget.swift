import Foundation

/// Which Binding a read goes through, and which Project it answers for.
///
/// The Project id travels with the Binding because health is keyed on both (#260): the same
/// Account bound by two Projects is two connections, and one of them can be failing.
///
/// One type for both ports, because both read the same way: a scope, a grant, and a Project to file
/// the health reading under.
public struct PortReadTarget: Sendable {
    public let binding: ResolvedBinding
    public let projectID: String

    public init(binding: ResolvedBinding, projectID: String) {
        self.binding = binding
        self.projectID = projectID
    }

    /// The three facts a read and a health record need, named here so a caller asks the target
    /// rather than walking `binding.binding` at every site.
    var scope: String {
        binding.binding.scope
    }

    var accountID: String {
        binding.binding.accountID
    }

    var projectBinding: ProjectBinding {
        binding.binding
    }

    /// The owner half of a GitHub `owner/repo`, which is the only part some of its query parameters
    /// take.
    var scopeOwner: String {
        String(scope.prefix { $0 != "/" })
    }
}
