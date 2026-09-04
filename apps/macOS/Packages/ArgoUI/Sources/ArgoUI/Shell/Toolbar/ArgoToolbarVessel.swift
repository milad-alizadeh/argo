import ArgoDesign
import SwiftUI

/// What the toolbar's containers are measured at. Every one of these is
/// a content MEASURE — a slot sized to the sentence it holds — so each carries its reason here
/// rather than naming a step of `ArgoSpacing`.
public enum ArgoToolbarVessel {
    /// How tall a container on the toolbar is. It was measured off a render at 36 and is now
    /// DERIVED at the same 36 — an icon button's box plus the inset every vessel spends round one
    /// (#1243). The band's containers and the capsules of icon buttons standing in it are the same
    /// height because they are the same arithmetic, rather than because two numbers happen to
    /// agree.
    public static var height: CGFloat {
        ArgoControlBox.vessel
    }

    public static let connectionSlotWidth: CGFloat = 180
    /// A floor and a ceiling rather than one width. The chip's longest reading names a provider,
    /// an identity and a state — and an account-level failure truncated to `GitHub · wor…` names
    /// neither the identity that broke nor the one to reconnect, which is the whole thing the
    /// account level exists to say. The ceiling keeps a provider's own long sentence from taking
    /// the deck's whole leading edge.
    public static let connectionSlotMaximumWidth: CGFloat = 320

    /// Past this, one Project name would take the deck's whole leading edge.
    public static let projectVesselMaximumWidth: CGFloat = 220
}
