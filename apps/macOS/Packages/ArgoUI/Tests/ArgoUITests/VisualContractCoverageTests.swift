@testable import ArgoUI
import Testing

/// The guard that makes every other colour claim reachable by a human.
///
/// A palette role is only as reviewed as the place it can be looked at, and `ContractSpecimen`
/// is that place. This suite proves the specimen is COMPLETE — not by a count somebody maintains,
/// but by reflecting the role groups themselves.
@Suite("Visual contract — nothing is invisible")
struct VisualContractCoverageTests {
    static let palettes = ArgoPalette.all

    /// Every role reaches the specimen, proved by reflection rather than by remembering.
    ///
    /// The `all` arrays are what `ContractSpecimen` renders, so a role missing from one is a
    /// colour that ships without ever being looked at — which is exactly how the lavender lasted:
    /// the specimen drew four of six groups and none of the text inks, so there was nowhere the
    /// mistake could be seen. `Mirror` reads the stored properties, so the check cannot be
    /// satisfied by updating a count.
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
