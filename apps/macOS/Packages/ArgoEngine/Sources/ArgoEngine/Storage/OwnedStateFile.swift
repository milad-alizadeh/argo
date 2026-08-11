import Foundation

/// One file of Argo's own state, read and written whole. Per-machine and never committed, which is
/// every durable thing Argo owns (ADR-0008).
///
/// Synchronous rather than an actor: the callers are `@MainActor` methods that cannot await. Every
/// mutation reads, transitions and writes in one hop, so two windows changing the same state at
/// once lose nothing of each other's.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test or render harness that named no
/// folder must not read or write the machine's real state.
@MainActor
struct OwnedStateFile<Value: Codable & Sendable> {
    let fileURL: URL?

    /// A file that cannot be read is the empty value — never written, half-written, hand-edited.
    func load(orEmpty empty: Value) -> Value {
        guard let fileURL,
              let data = try? Data(contentsOf: fileURL),
              let value = try? JSONDecoder().decode(Value.self, from: data)
        else { return empty }
        return value
    }

    /// A file that cannot be written still leaves the caller holding the answer: the change stands
    /// for this launch and is forgotten by the next one. Refusing the gesture would be worse.
    func write(_ value: Value) {
        guard let fileURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
            )
            try encoder.encode(value).write(to: fileURL, options: .atomic)
        } catch {
            // Nothing to recover: the value the caller holds is the answer either way.
        }
    }
}
