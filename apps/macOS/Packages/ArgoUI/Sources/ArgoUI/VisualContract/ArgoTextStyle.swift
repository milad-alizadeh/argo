import SwiftUI

/// Which of the two system families a role is set in. Named rather than inlined as a `Font.Design`
/// so the contract can assert where each family is allowed to appear.
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

/// A named combination of face, rung and weight, for the lines of the shell that recur. A
/// convenience over `ArgoTypeScale` and never a second scale: it cannot hold a size the HIG's
/// ladder does not have.
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

    /// The role's NOMINAL line box: the documented size at the ladder's ratio. What the chrome is
    /// sized from — a badge, a menu row — and what the design studies behind those numbers were
    /// reconciled against.
    ///
    /// It is not what a line of this role is DRAWN at; `ArgoTypeScale.lineBox` is, and it runs
    /// about a point and a half taller at `body`. Anything measuring a line it also draws reads
    /// that one, and reading this instead is the mismatch #766 was.
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
