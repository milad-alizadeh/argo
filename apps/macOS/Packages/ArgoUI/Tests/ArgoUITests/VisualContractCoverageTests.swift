@testable import ArgoUI
import Testing

/// The guard that makes every other colour claim reachable by a human: it proves
/// `ContractSpecimen` is COMPLETE by reflecting the role groups rather than by a maintained count.
@Suite("Visual contract — nothing is invisible")
struct VisualContractCoverageTests {
    static let palettes = ArgoPalette.all

    /// An `unwired` entry naming no role is deleted, not left to excuse a future one. A renamed
    /// role fails here rather than silently marking nothing.
    @Test
    func `every unwired note names a role that exists`() {
        let families = [
            Family("ArgoTypography", ArgoTypography.unwired, ArgoTypography.all.map(\.name)),
            Family("ArgoMotion", ArgoMotion.unwired, ArgoMotion.all.map(\.name)),
            Family("ArgoElevation", ArgoElevation.unwired, ArgoElevation.all.map(\.name)),
        ]
        for family in families {
            for name in family.unwired.keys {
                #expect(
                    family.roles.contains(name),
                    "\(family.name).unwired names \(name), which is not a role",
                )
            }
        }
    }

    /// Every role reaches the specimen. The `all` arrays are what `ContractSpecimen` renders, so a
    /// role missing from one is a colour that ships without ever being looked at. `Mirror` reads
    /// the stored properties, so the check cannot be satisfied by updating a count.
    @Test(arguments: palettes)
    func `every colour role appears in its group's catalog`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let groups = [
            Group("surface", palette.surface, palette.surface.all),
            Group("text", palette.text, palette.text.all),
            Group("edge", palette.edge, palette.edge.all),
            Group("interaction", palette.interaction, palette.interaction.all),
            Group("state", palette.state, palette.state.all),
            Group("diff", palette.diff, palette.diff.all),
        ]
        for group in groups {
            let stored = Mirror(reflecting: group.roles).children.compactMap(\.label)
            for role in stored {
                #expect(
                    group.catalog.contains(role),
                    "\(appearance.name).\(group.name).\(role) is missing from its `all` catalog, so ContractSpecimen never draws it",
                )
            }
            #expect(stored.count == group.catalog.count)
        }
    }

    /// One role group, paired with the catalog that is supposed to enumerate it.
    private struct Family {
        let name: String
        let unwired: [String: String]
        let roles: [String]

        init(_ name: String, _ unwired: [String: String], _ roles: [String]) {
            self.name = name
            self.unwired = unwired
            self.roles = roles
        }
    }

    private struct Group {
        let name: String
        let roles: Any
        let catalog: [String]

        init(_ name: String, _ roles: Any, _ catalog: [(name: String, color: ArgoColor)]) {
            self.name = name
            self.roles = roles
            self.catalog = catalog.map(\.name)
        }
    }
}
