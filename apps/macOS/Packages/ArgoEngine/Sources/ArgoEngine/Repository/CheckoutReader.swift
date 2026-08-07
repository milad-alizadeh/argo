import Foundation

actor CheckoutReader {
    func read(at candidateURL: URL) -> CheckoutProjection {
        guard let root = git(["rev-parse", "--show-toplevel"], at: candidateURL) else {
            return CheckoutProjection(repositoryURL: candidateURL, head: .unavailable)
        }
        let repositoryURL = URL(fileURLWithPath: root).standardizedFileURL
        guard let branch = git(["rev-parse", "--abbrev-ref", "HEAD"], at: repositoryURL) else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .unavailable)
        }
        guard branch == "HEAD" else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .branch(branch))
        }
        guard let shortSHA = git(["rev-parse", "--short", "HEAD"], at: repositoryURL) else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .unavailable)
        }
        return CheckoutProjection(repositoryURL: repositoryURL, head: .detached(shortSHA: shortSHA))
    }

    private func git(_ arguments: [String], at directoryURL: URL) -> String? {
        let process = Process()
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["git", "-C", directoryURL.path] + arguments
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0,
              let value = String(data: data, encoding: .utf8)?
              .trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty
        else { return nil }
        return value
    }
}
