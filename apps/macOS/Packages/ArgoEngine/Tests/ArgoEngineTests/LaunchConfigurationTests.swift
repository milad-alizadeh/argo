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

    /// The flag takes no value, and `specimens.sh` passes it LAST — where a parser reading the
    /// next argument for every flag would never see it at all.
    @Test
    func `the list flag is read at the end of the arguments`() {
        let configuration = LaunchConfiguration(
            arguments: ["Argo", "--project", "/tmp/argo", "--list-specimens"],
            currentDirectoryURL: URL(fileURLWithPath: "/tmp"),
        )

        #expect(configuration.listsSpecimens)
        #expect(configuration.projectURL.path == "/tmp/argo")
    }

    @Test
    func `an ordinary launch does not ask for the list`() {
        let configuration = LaunchConfiguration(
            arguments: ["Argo", "--specimen", "feedCalls"],
            currentDirectoryURL: URL(fileURLWithPath: "/tmp/argo"),
        )

        #expect(!configuration.listsSpecimens)
        #expect(configuration.specimenName == "feedCalls")
    }
}
