@testable import ArgoEngine
import Foundation
import Testing

@Suite("Launch Project")
struct LaunchProjectTests {
    private let launchDirectoryURL = URL(fileURLWithPath: "/Users/milad/Developer/argo")
    private let registered = ProjectRecord(id: "cockpit", path: "/Users/milad/Developer/cockpit")

    @Test
    func `a launch with nothing registered opens where the process was started`() {
        let launch = LaunchProject.resolve(
            configuration: configuration(),
            registry: .empty,
        )

        #expect(launch == .unregistered(launchDirectoryURL))
    }

    @Test
    func `a launch with no override opens into the active registered Project`() {
        let launch = LaunchProject.resolve(
            configuration: configuration(),
            registry: registry(),
        )

        #expect(launch == .registered(registered))
    }

    @Test
    func `the override points the launch without registering the folder it names`() {
        let overrideURL = URL(fileURLWithPath: "/Users/milad/Experiments/argo")

        let launch = LaunchProject.resolve(
            configuration: configuration(projectOverrideURL: overrideURL),
            registry: registry(),
        )

        #expect(launch == .unregistered(overrideURL))
        #expect(launch.url == overrideURL)
    }

    /// Otherwise the strip would draw the same repository twice, once selected and once not.
    @Test
    func `an override naming a registered Project resolves to that Project`() {
        let launch = LaunchProject.resolve(
            configuration: configuration(projectOverrideURL: registered.url),
            registry: registry(),
        )

        #expect(launch == .registered(registered))
        #expect(launch.id == registered.id)
    }

    /// An unregistered folder has no Project id, and the strip still has to tell one mark from
    /// another — so it is addressed by the only stable name it has.
    @Test
    func `an unregistered launch is addressed by its path`() {
        let launch = LaunchProject.resolve(configuration: configuration(), registry: .empty)

        #expect(launch.id == launchDirectoryURL.path)
    }

    private func configuration(projectOverrideURL: URL? = nil) -> LaunchConfiguration {
        LaunchConfiguration(
            launchDirectoryURL: launchDirectoryURL,
            projectOverrideURL: projectOverrideURL,
            transcriptURLs: [],
        )
    }

    private func registry() -> ProjectRegistry {
        ProjectRegistry(projects: [registered], activeProjectID: registered.id)
    }
}
