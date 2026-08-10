import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The prompt's honesty rules: verbatim targets, the caption each kind earns, and a prompt only
/// while the Session is actually blocked on one.
@Suite("Permission prompt projection")
struct PermissionPromptProjectionTests {
    private func session(
        permission: PermissionRequest?,
        location: String? = "/Users/someone/repo",
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "A Session",
            model: "claude-opus-5",
            workspaceLocation: location,
            access: .managed,
            status: permission == nil ? .idle : .permission,
            permission: permission,
        )
    }

    private func request(_ target: PermissionRequest.Target, tool: String) -> PermissionRequest {
        PermissionRequest(id: "permission-1", toolName: tool, target: target)
    }

    @Test
    func `a Session with nothing pending raises no prompt`() {
        #expect(PermissionPromptProjection.prompt(for: session(permission: nil)) == nil)
        #expect(PermissionPromptProjection.prompt(for: nil) == nil)
    }

    @Test
    func `a command prompt names the tool and carries the command verbatim`() throws {
        let request = request(.command("rm -rf build"), tool: "Bash")
        let prompt = try #require(
            PermissionPromptProjection.prompt(for: session(permission: request)),
        )

        #expect(prompt.toolName == "Bash")
        #expect(prompt.subject == "wants to run a command in this Workspace")
        #expect(prompt.target == .command("rm -rf build"))
    }

    @Test
    func `a command's caption is the Workspace it would run in`() throws {
        let request = request(.command("ls"), tool: "Bash")
        let home = NSHomeDirectory()
        let prompt = try #require(PermissionPromptProjection.prompt(
            for: session(permission: request, location: "\(home)/repo"),
        ))

        #expect(prompt.caption == "~/repo")
    }

    @Test
    func `an edit's caption counts its lines and hunks`() throws {
        let request = request(
            .edit(path: "a.swift", hunks: [
                [DiffLine(side: .del, text: "old"), DiffLine(side: .add, text: "new")],
                [DiffLine(side: .add, text: "more")],
            ]),
            tool: "Edit",
        )
        let prompt = try #require(
            PermissionPromptProjection.prompt(for: session(permission: request)),
        )

        #expect(prompt.subject == "wants to write to a file")
        #expect(prompt.caption == "+2 −1 · 2 hunks")
    }
}
