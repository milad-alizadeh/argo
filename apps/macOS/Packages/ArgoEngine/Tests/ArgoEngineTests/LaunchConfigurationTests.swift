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
}
