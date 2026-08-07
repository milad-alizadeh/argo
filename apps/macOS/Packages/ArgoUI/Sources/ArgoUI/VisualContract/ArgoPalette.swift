/// Every colour role in the contract, grouped by the question it answers.
///
/// Colour is the only family that a future light appearance would change — type, geometry,
/// elevation and motion are appearance-independent — so it is the only one carried in the
/// environment rather than exposed as statics. A light appearance is a second `ArgoPalette`
/// value and an environment write; no call site moves.
public struct ArgoPalette: Sendable {
    public let surface: SurfaceRoles
    public let text: TextRoles
    public let edge: EdgeRoles
    public let interaction: InteractionRoles
    public let state: StateRoles

    public init(
        surface: SurfaceRoles,
        text: TextRoles,
        edge: EdgeRoles,
        interaction: InteractionRoles,
        state: StateRoles
    ) {
        self.surface = surface
        self.text = text
        self.edge = edge
        self.interaction = interaction
        self.state = state
    }
}

public extension ArgoPalette {
    /// The neutral ramp, darkest first. Depth is read off tonal separation between these
    /// steps and the hairline between them, never off a drop shadow.
    struct SurfaceRoles: Sendable {
        /// Behind everything: the well a deck or a scroller sits in.
        public let sunken: ArgoColor
        /// The Instrument Deck. Opaque by contract — glass is rationed elsewhere.
        public let base: ArgoColor
        /// A row, an inset card, a rail.
        public let raised: ArgoColor
        /// Popovers, menus, the quiet inspection surface.
        public let overlay: ArgoColor
        /// Laid under system Liquid Glass so a vessel keeps the graphite cast instead of
        /// picking up whatever is behind the window.
        public let glassTint: ArgoColor
        /// A row under the pointer, before selection.
        public let hover: ArgoColor
        /// The neutral wash a selected row carries. Selection is neutral here on purpose —
        /// the Ion Blue of selection is the indicator edge, not the fill.
        public let selected: ArgoColor

        public init(
            sunken: ArgoColor,
            base: ArgoColor,
            raised: ArgoColor,
            overlay: ArgoColor,
            glassTint: ArgoColor,
            hover: ArgoColor,
            selected: ArgoColor
        ) {
            self.sunken = sunken
            self.base = base
            self.raised = raised
            self.overlay = overlay
            self.glassTint = glassTint
            self.hover = hover
            self.selected = selected
        }

        /// The ramp in depth order, for contract assertions and the specimen.
        public var ramp: [ArgoColor] { [sunken, base, raised, overlay] }
    }

    struct TextRoles: Sendable {
        /// Titles and row primaries.
        public let primary: ArgoColor
        /// The one quiet metadata line.
        public let secondary: ArgoColor
        /// Machine facts and non-essential detail.
        public let tertiary: ArgoColor
        public let disabled: ArgoColor
        /// On an Ion Blue fill.
        public let onAccent: ArgoColor

        public init(
            primary: ArgoColor,
            secondary: ArgoColor,
            tertiary: ArgoColor,
            disabled: ArgoColor,
            onAccent: ArgoColor
        ) {
            self.primary = primary
            self.secondary = secondary
            self.tertiary = tertiary
            self.disabled = disabled
            self.onAccent = onAccent
        }
    }

    /// The primary depth device. Every edge is translucent white so it reads as a lit
    /// boundary on whatever surface it lands on, rather than as a drawn line.
    struct EdgeRoles: Sendable {
        /// The separator between two surfaces of the same tone.
        public let hairline: ArgoColor
        /// A control at rest.
        public let subtle: ArgoColor
        /// A control pressed, or a boundary that must not be missed.
        public let strong: ArgoColor
        /// The specular top rim that makes a glass vessel read as glass.
        public let glassRim: ArgoColor

        public init(
            hairline: ArgoColor,
            subtle: ArgoColor,
            strong: ArgoColor,
            glassRim: ArgoColor
        ) {
            self.hairline = hairline
            self.subtle = subtle
            self.strong = strong
            self.glassRim = glassRim
        }
    }

    /// Ion Blue and nothing else. Brand, interaction, selection, focus — never status.
    struct InteractionRoles: Sendable {
        /// The brand hue at rest.
        public let accent: ArgoColor
        /// Hover, and the focus ring.
        public let accentBright: ArgoColor
        /// Pressed.
        public let accentDeep: ArgoColor
        /// The thin edge that marks the selected row or the selected tab.
        public let selectionIndicator: ArgoColor
        /// The keyboard focus ring.
        public let focusRing: ArgoColor

        public init(
            accent: ArgoColor,
            accentBright: ArgoColor,
            accentDeep: ArgoColor,
            selectionIndicator: ArgoColor,
            focusRing: ArgoColor
        ) {
            self.accent = accent
            self.accentBright = accentBright
            self.accentDeep = accentDeep
            self.selectionIndicator = selectionIndicator
            self.focusRing = focusRing
        }
    }

    /// What a Session is doing. Independent of brand by contract: none of these may be Ion
    /// Blue, and no two of them may be near-neighbours.
    struct StateRoles: Sendable {
        /// A turn is in progress.
        public let running: ArgoColor
        /// Idle, and the completed/quiet end of the vocabulary. Deliberately not green:
        /// finished work should recede, not celebrate.
        public let idle: ArgoColor
        /// Needs you — a permission prompt, a question, a reconnecting chip.
        public let attention: ArgoColor
        /// Failed, refused, errored.
        public let failure: ArgoColor

        public init(
            running: ArgoColor,
            idle: ArgoColor,
            attention: ArgoColor,
            failure: ArgoColor
        ) {
            self.running = running
            self.idle = idle
            self.attention = attention
            self.failure = failure
        }

        public var all: [ArgoColor] { [running, idle, attention, failure] }

        /// The same role at chip strength: a tinted ground rather than an ink.
        public func muted(_ role: ArgoColor) -> ArgoColor { role.opacity(0.16) }
    }
}
