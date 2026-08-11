import Foundation

/// The chain's file, and the only thing that writes it. Beside the briefs it is about, in Argo's
/// own per-machine data and never in the Project.
///
/// Synchronous rather than an actor: the one caller is a `HandoffHost` method that cannot await.
/// Every mutation reads, transitions and writes in one hop, so two windows handing off at once lose
/// no link to each other.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test that never named a folder must
/// not read or write the machine's real chain.
@MainActor
public final class HandoffChainStore {
    /// Beside `handoffs/`'s briefs, which is where `Hub.handoffRoot` points.
    public static let defaultFileURL = Hub.handoffRoot.appending(path: "chain.json")

    private let fileURL: URL?

    public init(fileURL: URL?) {
        self.fileURL = fileURL
    }

    /// A chain that cannot be read is an empty one — never handed off, half-written, hand-edited.
    public func load() -> HandoffChain {
        guard let fileURL,
              let data = try? Data(contentsOf: fileURL),
              let chain = try? JSONDecoder().decode(HandoffChain.self, from: data)
        else { return HandoffChain() }
        return chain
    }

    /// Fold a change into whatever is on disk NOW, and answer what the caller should hold. The
    /// caller's copy was loaded at launch, and another window may have handed off since.
    @discardableResult
    public func update(_ change: (inout HandoffChain) -> Bool) -> HandoffChain {
        var chain = load()
        guard change(&chain) else { return chain }
        persist(chain)
        return chain
    }

    /// A chain that cannot be written is still the chain this process will use: the link holds for
    /// this launch and is forgotten by the next one.
    private func persist(_ chain: HandoffChain) {
        guard let fileURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
            )
            try encoder.encode(chain).write(to: fileURL, options: .atomic)
        } catch {
            // Nothing to recover: the chain the caller holds is the answer either way.
        }
    }
}
