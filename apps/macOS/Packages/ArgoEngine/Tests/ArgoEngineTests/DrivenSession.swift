@testable import ArgoEngine
import Foundation

/// Which adapter the conformance suite is running against (#548). `Sendable` because it is what
/// parameterises the suite, and the fixture behind it is built inside each case.
enum DrivenCLI: CaseIterable, Sendable {
    case claude
    case codex

    var cli: AgentCLI {
        switch self {
        case .claude: .claude
        case .codex: .codex
        }
    }
}

/// One spawned Session of either CLI, with the one question the port's own claims need answering
/// about it: what the agent on the other end actually received.
///
/// The answer is read from unlike places — keystrokes at a prompt, JSON-RPC input items — which is
/// exactly why the suite needs this and cannot assert on bytes.
@MainActor
struct DrivenSession {
    let id: String
    /// The Turns the agent received, in order, as the text a person typed rather than as whatever
    /// the transport made of it.
    let turns: () -> [String]
    /// End the process behind it, the way its host reports one going.
    let end: () -> Void
    /// The Permission half: one gated call raised on the agent's side, and its answer (#549).
    let gate: DrivenGate
}

@MainActor
extension SpawnFixture {
    /// Spawn one Session of the named CLI and answer it as the suite sees it.
    func drive(_ driven: DrivenCLI) async throws -> DrivenSession {
        switch driven {
        case .claude: try await driveClaude()
        case .codex: try await driveCodex()
        }
    }

    private func driveClaude() async throws -> DrivenSession {
        let claim = try await hub.spawnSession(cli: .claude)
        let process = try started()
        let hook = ClaudeHook(self, claim)
        return DrivenSession(
            id: claim.value,
            turns: { Self.pastes(in: process.written.joined()) },
            end: { process.end(exitCode: 0) },
            gate: DrivenGate(
                raise: hook.raise,
                allowed: hook.allowed,
                close: hook.close,
            ),
        )
    }

    private func driveCodex() async throws -> DrivenSession {
        let session = try await openCodexSession()
        let process = try started()
        let peer = CodexApprovalPeer(server: session.server)
        return DrivenSession(
            id: session.id,
            turns: {
                session.server.turns.compactMap {
                    $0["input"]?.array.first?.stringField("text")
                }
            },
            end: { process.end(exitCode: 0) },
            gate: DrivenGate(
                raise: peer.raise,
                allowed: peer.allowed,
                // There is no socket to give back: the gate rides on the pipes the process owns.
                close: {},
            ),
        )
    }

    /// The Turns inside what was typed at a PTY: the text between each bracketed-paste pair. How
    /// the framing is BUILT is `ClaudeTurn`'s claim and its own suite's; here the markers are only
    /// how one Turn is told from the next.
    private static func pastes(in typed: String) -> [String] {
        typed.components(separatedBy: "\u{1B}[200~")
            .dropFirst()
            .compactMap { $0.components(separatedBy: "\u{1B}[201~").first }
    }

    private func started() throws -> FakeAgentProcess {
        guard let process = host.started.last else {
            throw CodexFixtureFault.nothingStarted
        }
        return process
    }
}

/// What a fixture could not set up. Its own error rather than a domain one: a bitmap that would not
/// allocate is not something Argo refused.
enum CodexFixtureFault: Error {
    case nothingStarted
    case noImage
}
