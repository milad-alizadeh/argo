import SwiftUI

public enum CockpitRoom: String, CaseIterable, Identifiable, Sendable {
    case sessions
    case work
    case code

    public var id: Self {
        self
    }

    public var title: String {
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

    public var shortcut: KeyEquivalent {
        switch self {
        case .sessions: "1"
        case .work: "2"
        case .code: "3"
        }
    }

    var shortcutDescription: String {
        switch self {
        case .sessions: "Command 1"
        case .work: "Command 2"
        case .code: "Command 3"
        }
    }
}
