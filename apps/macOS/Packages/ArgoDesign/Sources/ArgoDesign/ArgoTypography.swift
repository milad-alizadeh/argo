import SwiftUI

/// The handful of named roles the shell reuses, each one a rung of `ArgoTypeScale` — Apple's macOS
/// text styles — plus the weight and tracking that go with it. Nothing here carries a size.
public enum ArgoTypography {
    /// The largest line in the cockpit — a Project name, a specimen deck's header, an empty-state
    /// title.
    public static let identityHeading = ArgoTextStyle(
        typeface: .interface, rung: .title3, weight: .semibold,
    )

    /// The largest line the deck's CONTENT sets — a ticket's title (`cockpit-work-room.md`). One
    /// rung over `identityHeading`, which is the largest line the window's chrome sets.
    public static let sessionTitle = ArgoTextStyle(
        typeface: .interface, rung: .title2, weight: .semibold,
    )

    /// Sidebar and rail group labels.
    public static let sectionLabel = ArgoTextStyle(
        typeface: .interface, rung: .subheadline, weight: .semibold, tracking: 0.6,
    )
    /// `ArgoBadge`'s role, at the size `composer/perm.png` sets both of its badges — a 7px cap
    /// height, so 10 rather than `sectionLabel`'s 11.
    public static let badge = ArgoTextStyle(
        typeface: .interface, rung: .caption1, weight: .semibold, tracking: 0.6,
    )
    /// The window's own document title — the centred Session title (#691). `rowTitle` is this same
    /// 13 at `medium`, so the weight is the whole of what separates them.
    ///
    /// Named rather than inherited: macOS gives `headline` a semibold of its own, and the design
    /// froze semibold for the title, so a platform retune of the rung must not move it.
    public static let windowTitle = ArgoTextStyle(
        typeface: .interface, rung: .headline, weight: .semibold,
    )
    /// A heading inside a body of prose — the Tickets room's `Acceptance criteria` (#813). It is
    /// `body`'s own 13, so weight is the whole of what lifts it off the paragraph under it.
    ///
    /// `windowTitle` carries this tuple too, and neither may be folded into the other: a retune of
    /// the chrome's title must not reach a ticket's headings.
    public static let bodyHeading = ArgoTextStyle(
        typeface: .interface, rung: .headline, weight: .semibold,
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

    /// The one machine string a person has to TRANSCRIBE: the device flow's user code, at the title
    /// rung because it is read off one screen and typed into another.
    public static let machineDisplay = ArgoTextStyle(
        typeface: .machine, rung: .title2, weight: .semibold, tracking: 0.6,
    )
    /// A machine fact set beside the words it belongs to, at the size those words are set at — the
    /// plan pill's `Step 3/5`. Monospaced: in a proportional face a counter that changes while the
    /// reader watches re-measures on every step, shifting the sentence beside it.
    public static let machineBody = ArgoTextStyle(typeface: .machine, rung: .body)
    /// Branch, HEAD, elapsed, token counts.
    public static let machine = ArgoTextStyle(typeface: .machine, rung: .callout)
    public static let machineEmphasis = ArgoTextStyle(
        typeface: .machine, rung: .callout, weight: .medium,
    )
    public static let machineCaption = ArgoTextStyle(typeface: .machine, rung: .subheadline)

    /// Every role, for contract assertions and the specimen.
    public static let all: [(name: String, style: ArgoTextStyle)] = [
        ("identityHeading", identityHeading),
        ("sessionTitle", sessionTitle),
        ("sectionLabel", sectionLabel),
        ("badge", badge),
        ("windowTitle", windowTitle),
        ("bodyHeading", bodyHeading),
        ("rowTitle", rowTitle),
        ("rowMeta", rowMeta),
        ("body", body),
        ("control", control),
        ("caption", caption),
        ("machineDisplay", machineDisplay),
        ("machineBody", machineBody),
        ("machine", machine),
        ("machineEmphasis", machineEmphasis),
        ("machineCaption", machineCaption),
    ]

    /// Roles nothing sets yet. See `ArgoMotion.unwired` for why they stay and why they say so.
    /// `bodyHeading` left this list when the ticket's Children section began setting it (#814).
    public static let unwired: [String: String] = [:]
}
