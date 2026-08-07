@testable import ArgoEngine
import Foundation
import Testing

/// A throwaway machine: a registry file that does not exist yet, and real folders — some of them
/// real git repositories — to point it at.
///
/// The repositories are made with `git init` rather than faked, because the one thing the registry
/// has to get right about them is the root, and the root is git's answer.
struct ProjectFixture {
    let rootURL: URL

    init() throws {
        self.rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-projects-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    var registryFileURL: URL {
        rootURL.appending(path: "Argo/projects.json")
    }

    func store() -> ProjectRegistryStore {
        ProjectRegistryStore(fileURL: registryFileURL)
    }

    /// A folder, git or not, at a path relative to the fixture root.
    @discardableResult
    func folder(_ path: String, git: Bool = false) throws -> URL {
        let url = rootURL.appending(path: path, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        if git {
            try run(["git", "init", "--quiet"], at: url)
        }
        return url.standardizedFileURL
    }

    func move(_ url: URL, to path: String) throws -> URL {
        let destination = rootURL.appending(path: path, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: destination.deletingLastPathComponent(),
            withIntermediateDirectories: true,
        )
        try FileManager.default.moveItem(at: url, to: destination)
        return destination.standardizedFileURL
    }

    func remove(_ url: URL) throws {
        try FileManager.default.removeItem(at: url)
    }

    /// Writes the registry file directly, so a hand-edited or half-written file can be read back.
    func writeRegistryFile(_ contents: String) throws {
        try FileManager.default.createDirectory(
            at: registryFileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
        )
        try contents.write(to: registryFileURL, atomically: true, encoding: .utf8)
    }

    func readRegistryFile() throws -> String {
        try String(contentsOf: registryFileURL, encoding: .utf8)
    }

    private func run(_ arguments: [String], at directoryURL: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = arguments
        process.currentDirectoryURL = directoryURL
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
    }
}
