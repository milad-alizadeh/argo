import Foundation

/// The asserted links' file, and the only thing that writes it. In Argo's own per-machine data,
/// beside the project registry — never in the Project, because a branch a colleague never checked
/// out is not their business (ADR-0017).
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test or render harness that named no
/// folder must not read or write the machine's real assertions.
@MainActor
public final class DeliveryAssertionStore {
    nonisolated public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "delivery-links.json")

    private let file: OwnedStateFile<DeliveryAssertions>

    public init(fileURL: URL? = defaultFileURL) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// A file that cannot be read is an empty set of assertions, which grades every branch by what
    /// it derives to — the reading Argo had before anybody asserted anything.
    public func load() -> DeliveryAssertions {
        file.load(orEmpty: DeliveryAssertions())
    }

    /// Fold a change into whatever is on disk NOW, and answer what the caller should hold —
    /// another window may have asserted since the caller loaded its copy.
    ///
    /// `held` is that copy, and it is the base only where there is no file: a store that remembers
    /// nothing across launches must still remember within one.
    @discardableResult
    public func update(
        folding held: DeliveryAssertions,
        _ change: (inout DeliveryAssertions) -> Void,
    )
        -> DeliveryAssertions {
        var assertions = file.fileURL == nil ? held : load()
        change(&assertions)
        file.write(assertions)
        return assertions
    }
}
