import SwiftUI

/// What the toolbar's containers are measured at. Every one of these is
/// a content MEASURE — a slot sized to the sentence it holds — so each carries its reason here
/// rather than naming a step of `ArgoSpacing`.
public enum ArgoToolbarVessel {
    /// How tall a container on the toolbar is, measured off a render. A control drawing a
    /// container of its OWN cannot inherit it from the toolbar, which sizes its own glass.
    public static let height: CGFloat = 36

    public static let connectionSlotWidth: CGFloat = 180
    /// A floor and a ceiling rather than one width. The chip's longest reading names a provider,
    /// an identity and a state — and an account-level failure truncated to `GitHub · wor…` names
    /// neither the identity that broke nor the one to reconnect, which is the whole thing the
    /// account level exists to say. The ceiling keeps a provider's own long sentence from taking
    /// the deck's whole leading edge.
    public static let connectionSlotMaximumWidth: CGFloat = 320

    // The Project half of the toolbar's scope capsule: wider than the checkout half, which
    // carries only a branch.
    public static let projectVesselMaximumWidth: CGFloat = 220
    public static let scopeDividerHeight: CGFloat = 16
}
