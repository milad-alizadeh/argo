@testable import ArgoUI
import Testing

/// What the toolbar's checkout half says about the global primary checkout. The label and the
/// spoken value answered the same `Checkout` from two switches on a `View`; here they are one
/// value, so the quiet state cannot be quiet in one of them and not the other.
@Suite("Checkout reading")
struct CheckoutReadingTests {
    @Test
    func `a named branch is drawn and spoken as a branch`() {
        let reading = CheckoutReading(checkout: .branch("main"))

        #expect(reading.label == "main")
        #expect(reading.help == "Global checkout — main")
        #expect(reading.announcement == "Global checkout, branch main")
    }

    @Test
    func `a detached HEAD names the commit it is on`() {
        let reading = CheckoutReading(checkout: .detached(shortSHA: "9011669"))

        #expect(reading.label == "HEAD · 9011669")
        #expect(reading.help == "Global checkout — HEAD · 9011669")
        #expect(reading.announcement == "Global checkout, detached HEAD 9011669")
    }

    /// Degrade-down: with nothing registered there is no checkout to name, and a git internal
    /// standing in for a branch is the nearest guess the rule forbids.
    @Test
    func `no HEAD reads as unknown rather than as a branch called HEAD`() {
        let reading = CheckoutReading(checkout: .unavailable)

        #expect(reading.label == "unknown")
        #expect(reading.announcement == "Global checkout, HEAD unavailable")
    }

    @Test
    func `the tooltip never says more than the label it hovers`() {
        for checkout in Self.every {
            let reading = CheckoutReading(checkout: checkout)

            #expect(reading.help == "Global checkout — \(reading.label)")
        }
    }

    @Test
    func `the reading is taken from the presentation's checkout`() {
        #expect(CheckoutReading(presentation: .preview).label == "main")
        #expect(CheckoutReading(presentation: .unregisteredPreview).label == "unknown")
        #expect(CheckoutReading(presentation: .emptyPreview).label == "HEAD · 9011669")
    }

    private static let every: [CockpitPresentation.Checkout] = [
        .branch("main"),
        .detached(shortSHA: "9011669"),
        .unavailable,
    ]
}
