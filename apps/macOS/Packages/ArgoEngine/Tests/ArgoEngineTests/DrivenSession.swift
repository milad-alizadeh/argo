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

    /// What the port must declare about this CLI (#761), stated here rather than read back off the
    /// adapter: a surface asked of the router and answered by the wrong adapter agrees with itself.
    var surface: DriveSurface {
        switch self {
        case .claude: .everything
        case .codex:
            DriveSurface(takesAttachments: true, runsCommands: false, resolvesMentions: false)
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
    /// Put one chunk down the process's own output, and answer whether THIS Session's channel took
    /// it (#749) — the terminal's replay for `claude`, the thread's own reading for `codex`.
    let deliverOneChunk: () -> Bool
    /// What the terminal's replay buffer holds for this claim. Asymmetric on purpose: for `claude`
    /// it is the channel, and for `codex` it must stay empty.
    let replay: () -> String
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
            deliverOneChunk: { [hub] in
                process.emit(Self.chunk)
                return hub.replay(of: claim).contains(Self.chunk)
            },
            replay: { [hub] in hub.replay(of: claim) },
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
            // The thread's own word reaches the roster only by being PARSED, and this is an arm the
            // handshake could not have produced — so the reading proves THIS chunk landed.
            deliverOneChunk: { [hub] in
                session.server.statusChanged("active", flags: ["waitingOnApproval"])
                return hub.session(id: session.id)?.driveStatus == .permission
            },
            replay: { [hub] in
                guard let claim = hub.ownership.ownerOf(sessionID: session.id) else { return "" }
                return hub.replay(of: claim)
            },
            gate: DrivenGate(
                raise: peer.raise,
                allowed: peer.allowed,
                // There is no socket to give back: the gate rides on the pipes the process owns.
                close: {},
            ),
        )
    }

    /// One chunk of a Session's own output, distinctive enough to find again.
    private static let chunk = "argo-heard-this"

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

@MainActor
extension Hub {
    /// What the terminal's replay buffer holds for one claim, read the way a pane attaching later
    /// reads it — which is the only reader it has.
    func replay(of claim: SessionOwnership.ClaimID) -> String {
        var seen: [UInt8] = []
        let attached = terminals.attach(to: claim) { seen += $0 }
        attached?.detach()
        return String(bytes: seen, encoding: .utf8) ?? ""
    }
}

/// What a fixture could not set up. Its own error rather than a domain one: a bitmap that would not
/// allocate is not something Argo refused.
enum CodexFixtureFault: Error {
    case nothingStarted
    case noImage
}
