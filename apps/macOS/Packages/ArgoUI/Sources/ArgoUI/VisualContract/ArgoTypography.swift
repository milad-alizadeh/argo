import SwiftUI

/// The handful of named roles the shell reuses, each one a rung of `ArgoTypeScale` — Apple's macOS
/// text styles — plus the weight and tracking that go with it. Nothing here carries a size.
public enum ArgoTypography {
    /// The largest line in the cockpit: a Session's own title.
    public static let sessionTitle = ArgoTextStyle(
        typeface: .interface, rung: .title2, weight: .semibold,
    )
    /// A rare identity heading — a Project name, an empty-state title.
    public static let identityHeading = ArgoTextStyle(
        typeface: .interface, rung: .title3, weight: .semibold,
    )

    /// Sidebar and rail group labels.
    public static let sectionLabel = ArgoTextStyle(
        typeface: .interface, rung: .subheadline, weight: .semibold, tracking: 0.6,
    )
    /// A Session row's primary line.
    public static let rowTitle = ArgoTextStyle(typeface: .interface, rung: .body, weight: .medium)
    /// The one quiet metadata line under it.
    public static let rowMeta = ArgoTextStyle(typeface: .interface, rung: .subheadline)
    public static let body = ArgoTextStyle(typeface: .interface, rung: .body)
    /// Toolbar and vessel controls.
    public static let control = ArgoTextStyle(
        typeface: .interface, rung: .callout, weight: .medium,
    )
    public static let caption = ArgoTextStyle(typeface: .interface, rung: .caption1)

    /// A machine fact set beside the words it belongs to, at the size those words are set at — the
    /// plan pill's `Step 3/5` against the step it names. Monospaced deliberately: a counter that
    /// changes while the reader watches it re-measures the surface around it on every step in a
    /// proportional face, shifting the sentence beside it.
    public static let machineBody = ArgoTextStyle(typeface: .machine, rung: .body)
    /// Branch, HEAD, elapsed, token counts.
    public static let machine = ArgoTextStyle(typeface: .machine, rung: .callout)
    public static let machineEmphasis = ArgoTextStyle(
        typeface: .machine, rung: .callout, weight: .medium,
    )
    public static let machineCaption = ArgoTextStyle(typeface: .machine, rung: .subheadline)

    /// Every role, for contract assertions and the specimen.
    public static let all: [(name: String, style: ArgoTextStyle)] = [
        ("sessionTitle", sessionTitle),
        ("identityHeading", identityHeading),
        ("sectionLabel", sectionLabel),
        ("rowTitle", rowTitle),
        ("rowMeta", rowMeta),
        ("body", body),
        ("control", control),
        ("caption", caption),
        ("machineBody", machineBody),
        ("machine", machine),
        ("machineEmphasis", machineEmphasis),
        ("machineCaption", machineCaption),
    ]
}
