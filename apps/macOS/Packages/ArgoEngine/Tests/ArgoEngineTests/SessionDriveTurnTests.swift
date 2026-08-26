@testable import ArgoEngine
import Foundation
import Testing

/// The port's own attach-then-send (#540, #633). What an attachment becomes on the wire is
/// asserted beside `SessionTurn.text`, so this suite is about the JOIN: both halves go, in that
/// order, and neither goes alone. A Turn naming a file that was never written points the agent's
/// `Read` at nothing.
@Suite("Session drive turn")
@MainActor
struct SessionDriveTurnTests {
    @Test
    func `the Turn names the paths the attach answered`() throws {
        let driver = InMemorySessionDriver()
        let shot = SessionAttachment.pastedImage(Data([0x89]), fileExtension: "png")
        driver.attachmentPaths = [shot.id: URL(filePath: "/argo/shot.png")]

        try driver.send("See the gap.", attaching: [shot], to: "session-a")

        #expect(driver.sent(to: "session-a") == ["See the gap.\n\n/argo/shot.png"])
        #expect(driver.attached(to: "session-a").map(\.id) == [shot.id])
    }

    /// An adapter that takes nothing refuses before it writes, so there is no message to strand.
    @Test
    func `a refused attach sends nothing at all`() {
        let driver = InMemorySessionDriver()
        driver.declaredSurface = DriveSurface(
            takesAttachments: false, runsCommands: true, resolvesMentions: true,
        )
        let shot = SessionAttachment.pastedImage(Data([0x89]), fileExtension: "png")

        #expect(throws: SessionDriveError.cannotAttach) {
            try driver.send("See the gap.", attaching: [shot], to: "session-a")
        }
        #expect(driver.sent(to: "session-a").isEmpty)
    }

    /// A Turn with nothing attached is still a Turn, and it goes exactly as it was typed.
    @Test
    func `a message with nothing attached goes through untouched`() throws {
        let driver = InMemorySessionDriver()

        try driver.send("Carry on.", attaching: [], to: "session-a")

        #expect(driver.sent(to: "session-a") == ["Carry on."])
    }
}
