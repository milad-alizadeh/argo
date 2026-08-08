import Foundation

/// Where a CLI actually lives on this Mac.
///
/// The process host `execve`s an absolute path, so the lookup happens HERE rather than in the
/// forked child — which is the whole point. `claude` missing from the `PATH` is the commonest
/// spawn failure there is (#361), and resolving it up front turns a child that dies wordlessly
/// into a refusal the cockpit can repeat back.
enum AgentExecutable {
    /// The first entry of `searchPath` holding an executable file by that name.
    static func locate(_ command: String, on searchPath: String) -> String? {
        searchPath
            .split(separator: ":")
            .map { URL(fileURLWithPath: String($0)).appending(path: command).path }
            .first { FileManager.default.isExecutableFile(atPath: $0) }
    }
}
