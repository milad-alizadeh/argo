@testable import ArgoEngine
import Foundation
import Testing

/// The one Delivery fact Argo owns rather than derives: a branch a human pointed at a ticket
/// (ADR-0017).
@Suite("Delivery assertion file")
struct DeliveryAssertionFileTests {
    /// A throwaway folder holding one assertions file that does not exist yet.
    struct Fixture: ~Copyable {
        let rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-links-\(UUID().uuidString)", directoryHint: .isDirectory)

        @MainActor
        func store() -> DeliveryAssertionStore {
            DeliveryAssertionStore(fileURL: rootURL.appending(path: "delivery-links.json"))
        }

        deinit {
            try? FileManager.default.removeItem(at: rootURL)
        }
    }

    @MainActor
    @Test
    func `an assertion survives the launch that made it`() {
        let fixture = Fixture()
        fixture.store().update(folding: DeliveryAssertions()) {
            $0.assert(31, forBranch: "hotfix", in: "P1")
        }

        #expect(fixture.store().load().number(ofBranch: "hotfix", in: "P1") == 31)
    }

    @MainActor
    @Test
    func `a second assertion does not erase the first`() {
        let fixture = Fixture()
        let store = fixture.store()
        store.update(folding: DeliveryAssertions()) { $0.assert(31, forBranch: "hotfix", in: "P1") }
        store.update(folding: DeliveryAssertions()) { $0.assert(7, forBranch: "spike", in: "P1") }

        #expect(store.load().number(ofBranch: "hotfix", in: "P1") == 31)
    }

    @MainActor
    @Test
    func `a withdrawn assertion leaves the branch as it derived`() {
        let fixture = Fixture()
        let store = fixture.store()
        store.update(folding: DeliveryAssertions()) { $0.assert(31, forBranch: "hotfix", in: "P1") }
        store.update(folding: DeliveryAssertions()) { $0.withdraw(branch: "hotfix", in: "P1") }

        #expect(store.load().number(ofBranch: "hotfix", in: "P1") == nil)
    }

    @MainActor
    @Test
    func `a store that names no folder remembers nothing across launches`() {
        // A test or render harness must not read or write the machine's real assertions.
        let store = DeliveryAssertionStore(fileURL: nil)
        store.update(folding: DeliveryAssertions()) { $0.assert(31, forBranch: "hotfix", in: "P1") }

        #expect(store.load().number(ofBranch: "hotfix", in: "P1") == nil)
    }

    @MainActor
    @Test
    func `a store that names no folder still answers the caller that asserted`() {
        let held = DeliveryAssertionStore(fileURL: nil).update(folding: DeliveryAssertions()) {
            $0.assert(31, forBranch: "hotfix", in: "P1")
        }

        #expect(held.number(ofBranch: "hotfix", in: "P1") == 31)
    }
}
