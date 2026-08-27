/// What the toolbar's checkout half draws: one word for the global primary checkout, plus the
/// tooltip and the spoken value built from it.
///
/// A reading rather than two `switch`es on the `View`, which is what let the drawn word and the
/// spoken one answer the same `Checkout` separately. The tooltip is the label, so a checkout that
/// degrades down degrades down in all three at once.
struct CheckoutReading: Equatable {
    let label: String
    let help: String
    let announcement: String
}

extension CheckoutReading {
    init(presentation: CockpitPresentation) {
        self.init(checkout: presentation.checkout)
    }

    init(checkout: CockpitPresentation.Checkout) {
        let label = Self.label(for: checkout)
        self.init(
            label: label,
            help: "Global checkout — \(label)",
            announcement: "Global checkout, \(Self.spoken(checkout))",
        )
    }

    private static func label(for checkout: CockpitPresentation.Checkout) -> String {
        switch checkout {
        case let .branch(branch): branch
        case let .detached(shortSHA): "HEAD · \(shortSHA)"
        // Not "HEAD": with nothing registered there is no checkout to name, and a git internal
        // standing in for a branch is the nearest guess the degrade-down rule forbids.
        case .unavailable: "unknown"
        }
    }

    private static func spoken(_ checkout: CockpitPresentation.Checkout) -> String {
        switch checkout {
        case let .branch(branch): "branch \(branch)"
        case let .detached(shortSHA): "detached HEAD \(shortSHA)"
        case .unavailable: "HEAD unavailable"
        }
    }
}
