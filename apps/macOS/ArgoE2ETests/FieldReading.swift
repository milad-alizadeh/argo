import XCTest

/// Reading a composer field back, for the two cases that press keys at one.
///
/// On `XCTestCase` rather than on `E2ECase`, because `ComposerKeysE2ETests` launches its own app
/// and is not one — and both of them need the wait, which is the whole reason this is shared.
extension XCTestCase {
    /// The field's own words, waited for rather than read once: a keystroke crosses AppKit, the
    /// draft and SwiftUI's next layout before the value here can change, so an assertion made the
    /// instant `typeKey` returns is a race the field usually loses.
    func settles(_ field: XCUIElement, on words: String) -> Bool {
        let reads = expectation(
            for: NSPredicate(format: "value == %@", words),
            evaluatedWith: field,
        )
        return XCTWaiter.wait(for: [reads], timeout: 10) == .completed
    }

    /// What the field reads right now, for the message on a failed wait.
    func read(_ field: XCUIElement) -> String {
        String(describing: field.value)
    }
}
