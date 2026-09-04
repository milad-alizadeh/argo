import ArgoDesign
import SwiftUI

public enum CockpitRoom: String, CaseIterable, Identifiable, Sendable {
    case sessions
    case tickets
    case code
    case atlas

    public var id: Self {
        self
    }

    public var title: String {
        switch self {
        case .sessions: "Sessions"
        case .tickets: "Tickets"
        case .code: "Code"
        case .atlas: "Atlas"
        }
    }

    var symbol: String {
        switch self {
        case .sessions: ArgoSymbol.sessionsRoom
        case .tickets: ArgoSymbol.ticketsRoom
        case .code: ArgoSymbol.codeRoom
        case .atlas: ArgoSymbol.atlasRoom
        }
    }

    public var shortcut: KeyEquivalent {
        switch self {
        case .sessions: "1"
        case .tickets: "2"
        case .code: "3"
        case .atlas: "4"
        }
    }

    var shortcutDescription: String {
        switch self {
        case .sessions: "Command 1"
        case .tickets: "Command 2"
        case .code: "Command 3"
        case .atlas: "Command 4"
        }
    }

    /// Since #690 the tab draws no word, so this is the only place a sighted reader reads one.
    var tooltip: String {
        "\(title) — \(shortcutDescription)"
    }

    /// A comma, not the tooltip's dash: VoiceOver announces an em dash rather than pausing on it.
    var voiceOverLabel: String {
        "\(title), \(shortcutDescription)"
    }
}
