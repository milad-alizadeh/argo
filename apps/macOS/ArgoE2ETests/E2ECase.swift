import XCTest

/// The launch every case in this target shares: one named specimen, one app, one foreground wait.
/// Cases differ in which state they open on, and the room bases below add the gestures their own
/// surface is driven with.
///
/// A test must open onto a `--specimen` and never the machine's own registry, or it asserts
/// whatever that Mac happens to have on it (`docs/agents/visual-verification.md`).
///
/// `@MainActor` because `XCUIApplication()` is isolated to it under Swift 6.
@MainActor
class E2ECase: XCTestCase {
    /// Which named state the app opens on. Every case answers it; the base answers it for none.
    var specimen: String {
        preconditionFailure("A case must name the specimen it opens on.")
    }

    let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", specimen]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }
}
