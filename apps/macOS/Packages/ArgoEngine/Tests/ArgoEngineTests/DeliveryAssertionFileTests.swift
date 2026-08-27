@testable import ArgoEngine
import Foundation
import Testing

/// The one Delivery fact Argo owns rather than derives: a branch a human pointed at a ticket
/// (ADR-0017).
@Suite("Delivery assertion file")
struct DeliveryAssertionFileTests {
    private static func fileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-links-\(UUID().uuidString)")
            .appending(path: "delivery-links.json")
    }

    @MainActor
    @Test
    func `an assertion survives the launch that made it`() {
        let url = Self.fileURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        DeliveryAssertionStore(fileURL: url).update(folding: DeliveryAssertions()) {
            $0.assert(31, forBranch: "hotfix", in: "P1")
        }

        let reloaded = DeliveryAssertionStore(fileURL: url).load()

        #expect(reloaded.number(ofBranch: "hotfix", in: "P1") == 31)
    }

    @MainActor
    @Test
    func `a second assertion does not erase the first`() {
        let url = Self.fileURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let store = DeliveryAssertionStore(fileURL: url)
        store.update(folding: DeliveryAssertions()) { $0.assert(31, forBranch: "hotfix", in: "P1") }
        store.update(folding: DeliveryAssertions()) { $0.assert(7, forBranch: "spike", in: "P1") }

        let reloaded = store.load()

        #expect(reloaded.number(ofBranch: "hotfix", in: "P1") == 31)
        #expect(reloaded.number(ofBranch: "spike", in: "P1") == 7)
    }

    @MainActor
    @Test
    func `a withdrawn assertion leaves the branch as it derived`() {
        let url = Self.fileURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let store = DeliveryAssertionStore(fileURL: url)
        store.update(folding: DeliveryAssertions()) { $0.assert(31, forBranch: "hotfix", in: "P1") }
        store.update(folding: DeliveryAssertions()) { $0.withdraw(branch: "hotfix", in: "P1") }

        #expect(store.load().number(ofBranch: "hotfix", in: "P1") == nil)
    }

    @MainActor
    @Test
    func `a store that names no folder remembers nothing across launches`() {
        // A test or render harness must not read or write the machine's real assertions.
        let store = DeliveryAssertionStore(fileURL: nil)
        let held = store.update(folding: DeliveryAssertions()) {
            $0.assert(31, forBranch: "hotfix", in: "P1")
        }

        #expect(held.number(ofBranch: "hotfix", in: "P1") == 31)
        #expect(store.load().number(ofBranch: "hotfix", in: "P1") == nil)
    }
}
