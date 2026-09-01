@testable import ArgoEngine
import Foundation
import Testing

/// Which Project a swept transcript belongs to when the two sides spell its folder differently
/// (#363).
///
/// The Project is registered at whatever the user typed and the CLI records the path it resolved
/// to, so `/var/folders/…` and `/private/var/folders/…` reach the comparison as two strings for one
/// directory. Attribution is the seam that decides whether the Session enters a roster at all.
@Suite("Session discovery paths")
struct SessionDiscoveryPathTests {
    @Test
    func `a Project registered through a symlink holds the Session recorded past it`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let checkout = try fixture.directory("real-checkout")
        let projectURL = try fixture.symlink("checkout", to: checkout)
        // What the CLI writes: the folder with every symlink already followed, which under
        // `NSTemporaryDirectory` is never the string the Project was registered at.
        let recorded = resolvedTestPath(checkout.path)
        #expect(recorded != projectURL.path)
        let session = try fixture.write(FixtureTranscript(name: "resolved", cwd: recorded))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: projectURL)

        #expect(discovered == [session.standardizedFileURL])
    }

    /// A resolve is I/O and fails: the working directory of a Session recorded last week may have
    /// been deleted since. Degrade-down is to the string as WRITTEN, which still says this Session
    /// is inside this Project.
    @Test
    func `a working directory nothing can resolve is still inside its Project`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let checkout = try fixture.directory("checkout")
        // A worktree under the checkout that has since been reaped, named the way the CLI would
        // have recorded it while it existed.
        let gone = resolvedTestPath(checkout.path) + "/.claude/worktrees/reaped"
        let session = try fixture.write(FixtureTranscript(name: "reaped", cwd: gone))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: checkout)

        #expect(discovered == [session.standardizedFileURL])
    }

    /// Degrading to the raw string must not become a match nobody has evidence for: two folders
    /// neither side can resolve are compared exactly as written, and these two differ.
    @Test
    func `two unresolvable folders that are not the same folder do not match`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let elsewhere = fixture.path("gone-checkout-two/deep")
        try fixture.write(FixtureTranscript(name: "stranger", cwd: elsewhere))

        let projectURL = URL(fileURLWithPath: fixture.path("gone-checkout"))

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// A `cwd` nothing could resolve is compared as WRITTEN, and a relative one is then a path with
    /// its leading separator missing — the separator the comparison splits on. Compared as
    /// components it would sit inside a root it has never been under, so it is inside nothing.
    @Test
    func `a relative working directory is inside no Project`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(FixtureTranscript(name: "relative", cwd: "checkout/deep"))

        let projectURL = URL(fileURLWithPath: "/checkout")

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// And a `..` in one walks back out of the Project rather than counting as a component of it.
    @Test
    func `a working directory that walks back out of the Project is outside it`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(FixtureTranscript(name: "upward", cwd: "/checkout/../elsewhere"))

        let projectURL = URL(fileURLWithPath: "/checkout")

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// The observer is handed a resolver that answers nothing at all — a permission bite on every
    /// folder it asks about. The sweep still answers, on the strings it was given.
    @Test
    func `a resolver that answers nothing leaves the sweep reading the strings`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let session = try fixture.write(
            FixtureTranscript(name: "unresolvable", cwd: projectURL.path),
        )
        let discovery = SessionDiscovery(store: fixture.store, paths: { _ in [:] })

        #expect(await discovery.workingSet(for: projectURL) == [session.standardizedFileURL])
    }
}
