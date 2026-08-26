@testable import ArgoEngine
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// One real `codex app-server` under a real Hub, in a temp folder of its own.
///
/// Everything but the folder is the app's own composition: the real launcher resolving the user's
/// `PATH`, the engine's own pipe host, and the drive port the cockpit talks to. The PTY host is a
/// stand-in only because a Hub with none refuses to spawn at all — no `claude` is started here.
@MainActor
struct LiveCodex {
    /// Off unless asked for by name: these spend the user's tokens and take as long as an agent
    /// takes. `nonisolated` because the suite's own condition is checked outside any actor.
    nonisolated static let isEnabled =
        ProcessInfo.processInfo.environment["ARGO_LIVE_CLI"] == "1"

    let root: URL
    let projectURL: URL
    let hub: Hub
    private var claim: SessionOwnership.ClaimID?

    /// The patience is a parameter for the one test about it running out. Everywhere else it is a
    /// day, so Argo's clock is never what decides.
    init(patience: PermissionPatience = .default) throws {
        let token = String(UUID().uuidString.prefix(8))
        self.root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-codex-\(token)", directoryHint: .isDirectory)
        self.projectURL = root.appending(path: "project", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: projectURL, withIntermediateDirectories: true)
        self.hub = Hub(
            projectURL: projectURL,
            engine: Engine(readCheckout: CheckoutFixture().read, readLiveness: noLiveProcesses),
            spawnServices: SpawnServices(host: FakeProcessHost(), permissionPatience: patience),
        )
    }

    /// Spawn a Codex Session and answer the id the roster carries it under.
    mutating func spawn(mode: SessionMode = .code) async throws -> String {
        let claim = try await hub.spawnSession(cli: .codex, seed: SessionSeed(mode: mode))
        self.claim = claim
        return claim.value
    }

    /// The thread behind that Session, for the facts only the protocol carries — whether a Turn is
    /// in flight, above all.
    var thread: CodexThread? {
        claim.flatMap { hub.channels.codex.threads.thread(for: $0) }
    }

    /// What `codex --version` says, as the bare version — `codex-cli 0.147.0` answers `0.147.0`.
    static func installedVersion() throws -> String {
        let codex = Process()
        codex.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        codex.arguments = ["codex", "--version"]
        let output = Pipe()
        codex.standardOutput = output
        try codex.run()
        let said = String(
            data: output.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8,
        ) ?? ""
        codex.waitUntilExit()
        return said.split(separator: " ").last.map { String($0) }?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? said
    }

    /// A real PNG for an attachment to carry. Drawn here rather than embedded, so the fixture is
    /// something a reader can check rather than a base64 blob nobody can.
    func writeImage(named name: String) throws -> URL {
        let url = projectURL.appending(path: name)
        let size = 32
        guard let context = CGContext(
            data: nil,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue,
        ) else { throw CodexFixtureFault.noImage }
        context.setFillColor(red: 0.9, green: 0.2, blue: 0.2, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        guard let image = context.makeImage(),
              let destination = CGImageDestinationCreateWithURL(
                  url as CFURL,
                  UTType.png.identifier as CFString,
                  1,
                  nil,
              )
        else { throw CodexFixtureFault.noImage }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
        return url
    }

    func hasFile(_ name: String) -> Bool {
        FileManager.default.fileExists(atPath: projectURL.appending(path: name).path)
    }

    /// Wait for the agent, checking every quarter second. `false` when the wait ran out, so the
    /// assertion says the condition never came true rather than hanging the suite.
    func settle(seconds: Int = 150, until condition: () -> Bool) async -> Bool {
        for _ in 0 ..< (seconds * 4) {
            if condition() {
                return true
            }
            try? await Task.sleep(for: .milliseconds(250))
        }
        return condition()
    }

    func remove() {
        hub.endOwnedSessions()
        try? FileManager.default.removeItem(at: root)
    }
}
