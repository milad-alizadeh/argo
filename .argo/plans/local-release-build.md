# #1898 Local desktop release build

1. Add one root command for a local desktop release build.
2. Route the command through Turbo to the desktop workspace.
3. Keep the release build task uncached because it launches the packaged app.
4. Reuse the existing Forge package and packaged-PTY proof.
5. Keep the shipped arm64 architecture as the only build target.
6. Print the absolute path of each app that passes the proof.
7. Add source tests for the root, Turbo, and desktop task wiring.
8. Document setup, the command, the artifact path, and how to launch it.
9. State that the local app has no Developer ID signature or notarization.
10. Run the source suite, repository quality gate, and full local release build.

```yaml
criteria:
  - id: RELEASE-BUILD-1
    check: "The repository, Turbo, and desktop workspace expose one uncached local release build path."
    evidence: "test:apps/desktop/scripts/packaged-pty-checks.test.mjs"
  - id: RELEASE-BUILD-2
    check: "The local release command packages and runs the shipped app, then prints its absolute path."
    evidence: "cmd:bun run release:build"
  - id: RELEASE-BUILD-3
    check: "The repository quality gate remains green."
    evidence: "cmd:bun run quality"
```
