import XCTest

/// The reader walking five Sessions, twelve switches deep, in the real app (ADR-0030, Rule 4).
///
/// The claim every other suite makes one scope down, made where it can actually fail: no deck ever
/// draws two readings, and no deck comes back empty. Both are only reachable by clicking — the
/// switch runs through the real sidebar, the decks are AppKit views inside a SwiftUI tree, and a
/// package test has neither.
///
/// Five readings against a cap of six is deliberate: every deck is kept, so the walk is the case
/// the ticket is about rather than an eviction test. The readings are numbered from different turns
/// (`TranscriptFixtures.longTranscript(from:)`), so each one owns rows no other has — which is what
/// lets an overprint be seen at all. Two readings of the same fixture would look alike drawn over
/// each other.
///
/// Every switch is photographed into `ARGO_E2E_SHOTS` when it is set, so a human can look at the
/// twelve frames the assertions were made against.
@MainActor
final class KeptDeckSwitchE2ETests: FeedE2ECase {
    override var specimen: String {
        "fiveReadings"
    }

    /// Which row belongs to which reading: this reading's LAST turn edits (turn number `% 4 == 3`
    /// always does, and `longTranscript` ends on one), so the row this names is always there and
    /// near the tail the feed opens on — no scroll owed to reach it. No other reading has a turn
    /// numbered anywhere near it.
    private func edited(in reading: Int) -> String {
        "FeedView\(reading * 1000 + 51).swift"
    }

    private func rosterRow(_ reading: Int) -> XCUIElement {
        app.rosterRow(titled: "Reading \(reading + 1) of five, long enough to scroll")
    }

    func testTwelveSwitchesDrawOneReadingEach() throws {
        XCTAssertTrue(feed.waitForExistence(timeout: 30), "The deck drew no feed.")

        // Twelve switches over five readings, coming BACK to ones already open rather than walking
        // forward: the way back is what a kept deck is for.
        let walk = [1, 2, 0, 3, 1, 4, 2, 0, 4, 3, 1, 0]
        for (step, reading) in walk.enumerated() {
            let row = rosterRow(reading)
            XCTAssertTrue(
                row.waitForExistence(timeout: 15),
                "The roster drew no row for reading \(reading).",
            )
            row.click()
            try settle(onto: reading, at: step)
        }
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// The deck after one click: this reading drawn, no other reading's rows anywhere on it, and
    /// nothing standing in for a reading that has not arrived.
    private func settle(onto reading: Int, at step: Int) throws {
        let mine = row(naming: edited(in: reading))
        XCTAssertTrue(
            mine.waitForExistence(timeout: 20),
            "Switch \(step) onto reading \(reading) drew no row of that reading.",
        )
        photograph(step: step, reading: reading)
        // The overprint: another reading's rows drawn through the same deck.
        for other in 0 ..< 5 where other != reading {
            XCTAssertFalse(
                row(naming: edited(in: other)).exists,
                "Switch \(step) onto reading \(reading) also drew reading \(other).",
            )
        }
        // And the deck is not standing in for a reading past the delay.
        XCTAssertFalse(
            element(labelled: "Argo has not read this Session yet").exists,
            "Switch \(step) onto reading \(reading) left the deck provisional.",
        )
    }

    /// One frame per switch, where a directory was named. Written rather than only attached, so the
    /// twelve can be looked at side by side without opening a result bundle.
    private func photograph(step: Int, reading: Int) {
        let shot = XCUIScreen.main.screenshot()
        let attached = XCTAttachment(screenshot: shot)
        attached.name = "switch-\(step)-reading-\(reading)"
        attached.lifetime = .keepAlways
        add(attached)
        guard let directory = ProcessInfo.processInfo.environment["ARGO_E2E_SHOTS"] else { return }
        let file = URL(fileURLWithPath: directory)
            .appending(path: String(format: "switch-%02d-reading-%d.png", step, reading))
        try? FileManager.default.createDirectory(
            at: URL(fileURLWithPath: directory), withIntermediateDirectories: true,
        )
        try? shot.pngRepresentation.write(to: file)
    }
}
