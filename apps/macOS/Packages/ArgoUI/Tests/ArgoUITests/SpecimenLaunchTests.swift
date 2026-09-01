import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the specimen arguments decide before a window exists (ADR-0022). The app target used to
/// hold this, where the e2e suite could never reach it: it launches onto `--specimen` and never
/// builds the scene.
@MainActor
@Suite("Specimen launch")
struct SpecimenLaunchTests {
    /// The app target hands over its arguments and the folder it was started in, and reads the
    /// configuration back off the launch — so what it does with them is dispatch rather than a
    /// derivation no test can reach (ADR-0022, #858).
    @Test
    func `the launch reads the process's own arguments into a configuration`() {
        let launch = SpecimenLaunch(
            arguments: ["argo", "--project", "/tmp/somewhere"],
            currentDirectoryPath: "/tmp",
        )

        #expect(launch.configuration.projectURL.path == "/tmp/somewhere")
        #expect(launch.ending == nil)
        #expect(launch.entry == nil)
    }

    private static func launch(_ arguments: [String]) -> SpecimenLaunch {
        SpecimenLaunch(LaunchConfiguration(
            arguments: arguments, currentDirectoryURL: URL(fileURLWithPath: "/tmp"),
        ))
    }

    /// `scripts/specimens.sh` reads the list off stdout rather than parsing Swift source, so the
    /// names and the stream are both the contract.
    @Test
    func `listing the specimens answers one name per line and stops`() throws {
        let ending = try #require(Self.launch(["--list-specimens"]).ending)

        #expect(ending.code == 0)
        // A known entry by its literal name, so this cannot pass by echoing whatever the registry
        // happened to answer with, and one line per entry so nothing is dropped or doubled.
        #expect(ending.words.contains("ticketsRoom\n"))
        #expect(ending.words.split(separator: "\n").count == SpecimenRegistry.names.count)
    }

    /// A typo in the harness must not look like a launch worth screenshotting, so it refuses rather
    /// than drawing the cockpit under the name.
    @Test
    func `a name nothing answers to refuses the launch`() {
        let launch = Self.launch(["--specimen", "no-such-state"])

        #expect(launch.ending?.code == 1)
        #expect(launch.ending?.words.contains("no-such-state") == true)
        #expect(launch.entry == nil)
    }

    @Test
    func `a registered name renders that state`() throws {
        let name = try #require(SpecimenRegistry.names.first)

        let launch = Self.launch(["--specimen", name])

        #expect(launch.ending == nil)
        #expect(launch.entry?.name == name)
    }

    /// The ordinary launch: nothing named, so nothing is rendered and nothing stops.
    @Test
    func `a launch naming no specimen draws the cockpit`() {
        let launch = Self.launch([])

        #expect(launch.ending == nil)
        #expect(launch.entry == nil)
    }
}
