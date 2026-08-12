@testable import ArgoUI
import SwiftUI
import Testing

/// The two things about the registry no type can hold: nothing stops two entries sharing a name,
/// and nothing builds an entry until the harness launches it (#637).
@MainActor
struct SpecimenRegistryTests {
    @Test
    func `every entry resolves by its own name`() {
        for entry in SpecimenRegistry.all {
            #expect(SpecimenRegistry.entry(named: entry.name)?.name == entry.name)
        }
    }

    /// A duplicate would make the second entry unrenderable — `entry(named:)` answers with the
    /// first — and the harness would write one name's PNG twice.
    @Test
    func `no two entries share a name`() {
        let names = SpecimenRegistry.names

        #expect(names.count == Set(names).count)
    }

    /// Every entry's fixtures are read here. SwiftUI does not evaluate a `body` until something
    /// draws it, so this is not a render — what it covers is the arguments a fixture is passed as.
    @Test
    func `every entry builds a view from its fixtures`() {
        let built = SpecimenRegistry.all.map { $0.content() }

        #expect(built.count == SpecimenRegistry.all.count)
    }

    /// The registry is the whole catalog, not one subject's slice of it: a subject array left out
    /// of `all` would take its entries off the harness with nothing else failing.
    @Test
    func `every subject reaches the registry`() {
        let subjects = [
            SpecimenRegistry.roster,
            SpecimenRegistry.deck,
            SpecimenRegistry.header,
            SpecimenRegistry.feed,
            SpecimenRegistry.live,
            SpecimenRegistry.vessel,
            SpecimenRegistry.connect,
        ]

        #expect(SpecimenRegistry.all.count == subjects.map(\.count).reduce(0, +))
    }
}
