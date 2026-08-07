import Foundation

/// The external sources this process was launched against.
public struct LaunchConfiguration: Equatable, Sendable {
    public let projectURL: URL
    public let transcriptURLs: [URL]

    public init(projectURL: URL, transcriptURLs: [URL]) {
        self.projectURL = projectURL.standardizedFileURL
        self.transcriptURLs = transcriptURLs.map(\.standardizedFileURL)
    }

    public init(arguments: [String], currentDirectoryURL: URL) {
        let launchDirectoryURL = URL(
            fileURLWithPath: currentDirectoryURL.path,
            isDirectory: true,
        )
        var projectURL = launchDirectoryURL
        var transcriptURLs: [URL] = []
        var index = 0
        while index < arguments.count {
            let flag = arguments[index]
            guard index + 1 < arguments.count else { break }
            let value = arguments[index + 1]
            switch flag {
            case "--project":
                projectURL = URL(fileURLWithPath: value, relativeTo: launchDirectoryURL)
                index += 2
            case "--transcript":
                transcriptURLs.append(URL(fileURLWithPath: value, relativeTo: launchDirectoryURL))
                index += 2
            default:
                index += 1
            }
        }
        self.init(projectURL: projectURL, transcriptURLs: transcriptURLs)
    }
}
