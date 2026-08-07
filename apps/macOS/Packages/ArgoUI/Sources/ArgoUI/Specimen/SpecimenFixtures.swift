import Foundation

/// Placeholder content for the specimen surfaces the Hub does not yet feed. Sessions are NOT
/// among them: they come from `CockpitPresentation.preview` through the shell's own projection,
/// because a fixture shaped like a row is a second way to build one.
enum SpecimenFixtures {
    enum Room: String, CaseIterable, Identifiable {
        case sessions, work, code

        var id: Self {
            self
        }

        var title: String {
            switch self {
            case .sessions: "Sessions"
            case .work: "Work"
            case .code: "Code"
            }
        }

        var symbol: String {
            switch self {
            case .sessions: "waveform"
            case .work: "checklist"
            case .code: "chevron.left.forwardslash.chevron.right"
            }
        }
    }

    enum DeckTab: String, CaseIterable, Identifiable {
        case activity, delivery

        var id: Self {
            self
        }

        var title: String {
            switch self {
            case .activity: "Activity"
            case .delivery: "Delivery"
            }
        }
    }

    struct FeedEntry: Identifiable {
        let id = UUID()
        let symbol: String
        let prose: String
        let at: String
        var evidence: String?
    }

    static let feed: [FeedEntry] = [
        FeedEntry(
            symbol: "text.bubble",
            prose: "Reading the contract's colour roles before touching the palette.",
            at: "13:04:11",
        ),
        FeedEntry(
            symbol: "terminal",
            prose: "Ran the visual contract suite",
            at: "13:04:38",
            evidence: "swift test --filter VisualContractTests\n19 tests passed in 0.001s",
        ),
        FeedEntry(
            symbol: "doc.badge.plus",
            prose: "Added the graphite ramp and the Ion Blue interaction roles.",
            at: "13:05:02",
            evidence: "Sources/ArgoUI/VisualContract/GraphitePalette.swift  +44",
        ),
        FeedEntry(
            symbol: "exclamationmark.triangle",
            prose: "The neutral ramp drifted navy and the contract caught it.",
            at: "13:05:44",
            evidence: "✗ the neutral ramp is grey, not navy\n"
                + "  expected chromaticSpread <= 0.05, was 0.13",
        ),
        FeedEntry(
            symbol: "checkmark.circle",
            prose: "Pulled the blue back out of the neutrals; the suite is green again.",
            at: "13:06:20",
        ),
    ]
}
