import Foundation

/// The chain's file, and the only thing that writes it. Beside the briefs it is about, in Argo's
/// own per-machine data and never in the Project.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test that never named a folder must
/// not read or write the machine's real chain.
@MainActor
public final class HandoffChainStore {
    /// Beside `handoffs/`'s briefs, which is where `Hub.handoffRoot` points.
    public static let defaultFileURL = Hub.handoffRoot.appending(path: "chain.json")

    private let file: OwnedStateFile<HandoffChain>

    public init(fileURL: URL?) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// A chain that cannot be read is an empty one — never handed off, half-written, hand-edited.
    public func load() -> HandoffChain {
        file.load(orEmpty: HandoffChain())
    }

    /// Fold a change into whatever is on disk NOW, and answer what the caller should hold. The
    /// caller's copy was loaded at launch, and another window may have handed off since.
    @discardableResult
    public func update(_ change: (inout HandoffChain) -> Bool) -> HandoffChain {
        var chain = load()
        guard change(&chain) else { return chain }
        file.write(chain)
        return chain
    }
}
