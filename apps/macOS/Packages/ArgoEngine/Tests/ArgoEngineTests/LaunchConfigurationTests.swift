@testable import ArgoEngine
import Foundation
import Testing

@Suite("Launch configuration")
struct LaunchConfigurationTests {
    @Test
    func `launch paths resolve relative to the launch directory`() {
        let currentDirectoryURL = URL(fileURLWithPath: "/tmp/argo/apps/macOS")
        let configuration = LaunchConfiguration(
            arguments: [
                "Argo",
                "--project",
                "../..",
                "--transcript",
                "Fixtures/session.jsonl",
            ],
            currentDirectoryURL: currentDirectoryURL,
        )

        #expect(configuration.projectURL.path == "/tmp/argo")
        #expect(
            configuration.transcriptURLs.map(\.path)
                == ["/tmp/argo/apps/macOS/Fixtures/session.jsonl"],
        )
    }

    @Test
    func `ordinary launch arguments leave the current directory as the Project`() {
        let currentDirectoryURL = URL(fileURLWithPath: "/tmp/argo")
        let configuration = LaunchConfiguration(
            arguments: ["Argo", "-ApplePersistenceIgnoreState", "YES"],
            currentDirectoryURL: currentDirectoryURL,
        )

        #expect(configuration.projectURL.path == currentDirectoryURL.path)
        #expect(configuration.transcriptURLs.isEmpty)
    }

    /// The override has to be told apart from the default, because it points the Hub without
    /// registering anything and the registry only gets a say when nobody named a Project.
    @Test
    func `a launch that named no Project carries no override`() {
        let configuration = LaunchConfiguration(
            arguments: ["Argo"],
            currentDirectoryURL: URL(fileURLWithPath: "/tmp/argo"),
        )

        #expect(configuration.projectOverrideURL == nil)
        #expect(configuration.launchDirectoryURL.path == "/tmp/argo")
    }
}
