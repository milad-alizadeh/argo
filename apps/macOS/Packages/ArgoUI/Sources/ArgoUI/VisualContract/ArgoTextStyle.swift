import SwiftUI

/// Which of the two system families a role is set in. Named rather than inlined as a
/// `Font.Design` so the contract can assert where each family is allowed to appear — the
/// sans/mono split is the rule most easily broken by a hurried view.
public enum ArgoTypeface: Sendable, CaseIterable {
    /// SF Pro. Everything the interface says in its own voice, identity lines included.
    case interface
    /// SF Mono. Machine facts: branches, SHAs, paths, counts, command text.
    case machine

    var design: Font.Design {
        switch self {
        case .interface: .default
        case .machine: .monospaced
        }
    }
}

/// A named combination of face, rung and weight, for the lines of the shell that recur — a Session
/// row's title, a toolbar control, a group label.
///
/// A convenience over `ArgoTypeScale` and never a second scale: it cannot hold a size the HIG's
/// ladder does not have. Reach for the rung directly (`argoText(.body)`) unless the combination is
/// one that several surfaces have to agree on; a role per thing being drawn is how an app ends up
/// unable to say what size anything is.
public struct ArgoTextStyle: Sendable {
    public let typeface: ArgoTypeface
    public let rung: ArgoTypeScale
    /// `nil` takes the weight the HIG gives the rung.
    public let weight: Font.Weight?
    public let tracking: CGFloat

    public init(
        typeface: ArgoTypeface,
        rung: ArgoTypeScale,
        weight: Font.Weight? = nil,
        tracking: CGFloat = 0,
    ) {
        self.typeface = typeface
        self.rung = rung
        self.weight = weight
        self.tracking = tracking
    }

    /// The rung's documented size, for the layout arithmetic a line height has to do.
    public var size: CGFloat {
        rung.size
    }

    /// What one line of this role actually occupies, before any leading is added to it.
    ///
    /// A property of TYPE and of nothing else, which is why it is here. Two surfaces size
    /// themselves to a line: the feed's prose spends the difference as leading, and a badge
    /// spends it as a height. It lived on `ArgoFeedRow` while the feed was the only one asking,
    /// which made a contract-level primitive reach into a per-surface measure to find out how
    /// tall a line of type is.
    public var lineBox: CGFloat {
        rung.size * ArgoTypeScale.naturalLineHeightRatio
    }

    public var font: Font {
        .system(rung.style, design: typeface.design, weight: weight)
    }
}

public extension View {
    /// Applies a role's font and its tracking together — tracking is part of the role, and
    /// `.font()` alone silently drops it.
    func argoText(_ style: ArgoTextStyle) -> some View {
        font(style.font).tracking(style.tracking)
    }
}
