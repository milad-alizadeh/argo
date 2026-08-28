/// Every colour role in the contract, grouped by the question it answers. Carried in the
/// environment, not as statics: a light appearance is a second value and an environment write.
public struct ArgoPalette: Sendable {
    public let surface: SurfaceRoles
    public let text: TextRoles
    public let edge: EdgeRoles
    public let interaction: InteractionRoles
    public let state: StateRoles
    public let diff: DiffRoles

    public init(
        surface: SurfaceRoles,
        text: TextRoles,
        edge: EdgeRoles,
        interaction: InteractionRoles,
        state: StateRoles,
        diff: DiffRoles,
    ) {
        self.surface = surface
        self.text = text
        self.edge = edge
        self.interaction = interaction
        self.state = state
        self.diff = diff
    }
}

public extension ArgoPalette {
    /// Every appearance the app ships. The contract's assertions run over this rather than over
    /// `graphite` by name, so a second palette inherits every floor the day it is added.
    static let all: [(name: String, palette: ArgoPalette)] = [("graphite", .graphite)]

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
        /// The ground under a control on a surface which is not the deck — the Deny pill inside
        /// the Permission vessel. Translucent by contract: the same control is drawn on a glass
        /// vessel and on the flat Reduce Transparency fallback, and a step of the opaque ramp
        /// reads as a hole in one of them. It replaces the platform's own bordered fill, which on
        /// glass resolves within a point or two of the vessel.
        public let control: ArgoColor
        /// The neutral wash a control carries while it is pressed, open or current — a step in the
        /// evidence panel, the scoped chip on the rail. NOT the roster's selection, which is the
        /// brand hue as of #875: see `InteractionRoles.selectionGround`.
        public let selected: ArgoColor
        /// The ground something laid OVER the deck is read against — a picture opened full size.
        /// Near-opaque, and not a step of the ramp.
        public let scrim: ArgoColor
        /// The ground under a run of text marked as machine text — a `code` span mid-sentence.
        /// Translucent by contract: the same span is read on the deck AND inside a prompt's
        /// raised bubble, and an opaque ground would vanish on one of them.
        public let marked: ArgoColor

        public init(
            sunken: ArgoColor,
            base: ArgoColor,
            raised: ArgoColor,
            overlay: ArgoColor,
            glassTint: ArgoColor,
            hover: ArgoColor,
            control: ArgoColor,
            selected: ArgoColor,
            scrim: ArgoColor,
            marked: ArgoColor,
        ) {
            self.sunken = sunken
            self.base = base
            self.raised = raised
            self.overlay = overlay
            self.glassTint = glassTint
            self.hover = hover
            self.control = control
            self.selected = selected
            self.scrim = scrim
            self.marked = marked
        }

        /// The ramp in depth order, for contract assertions and the specimen.
        public var ramp: [ArgoColor] {
            [sunken, base, raised, overlay]
        }

        /// Every role, depth order first, then the grounds that are not steps of the ramp.
        public var all: [(name: String, color: ArgoColor)] {
            [
                ("sunken", sunken), ("base", base), ("raised", raised), ("overlay", overlay),
                ("glassTint", glassTint), ("hover", hover), ("control", control),
                ("selected", selected),
                ("scrim", scrim), ("marked", marked),
            ]
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
            glassRim: ArgoColor,
        ) {
            self.hairline = hairline
            self.subtle = subtle
            self.strong = strong
            self.glassRim = glassRim
        }

        public var all: [(name: String, color: ArgoColor)] {
            [
                ("hairline", hairline), ("subtle", subtle), ("strong", strong),
                ("glassRim", glassRim),
            ]
        }
    }

    /// Ion Blue — brand, interaction, selection, focus, never status — plus the one interaction
    /// that is deliberately not the brand: the ground under an act the reader may not want.
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
        /// The GROUND under a control that takes something away — the Archive behind a swiped
        /// roster row. Held a contract-asserted distance from `state.failure`, which it sits
        /// inches from on one roster row. A ground, not an ink: deep enough to carry
        /// `text.primary`.
        public let destructive: ArgoColor

        public init(
            accent: ArgoColor,
            accentBright: ArgoColor,
            accentDeep: ArgoColor,
            selectionIndicator: ArgoColor,
            focusRing: ArgoColor,
            destructive: ArgoColor,
        ) {
            self.accent = accent
            self.accentBright = accentBright
            self.accentDeep = accentDeep
            self.selectionIndicator = selectionIndicator
            self.focusRing = focusRing
            self.destructive = destructive
        }

        public var all: [(name: String, color: ArgoColor)] {
            [
                ("accent", accent), ("accentBright", accentBright), ("accentDeep", accentDeep),
                ("selectionIndicator", selectionIndicator), ("focusRing", focusRing),
                ("destructive", destructive),
            ]
        }

        /// The brand hue laid under a whole row as a GROUND rather than drawn as an ink — the one
        /// selection a reader tracks all day (#875 finding 1, amending D30). One hue, two weights:
        /// `accent` at full strength where a control is the loud rung, this where a row is merely
        /// selected.
        ///
        /// The weight is not a taste: at any more alpha the roster's own quietest voice falls below
        /// the legibility it has on `surface.selected`, which is the wash this replaces. The
        /// contract asserts exactly that.
        ///
        /// It is drawn by `SessionNavigator` as a row background, not by the platform: a macOS 26
        /// sidebar's selection capsule is a fixed neutral that neither `.tint` nor the
        /// `AccentColor` asset moves by a value.
        public var selectionGround: ArgoColor {
            accent.opacity(0.10)
        }
    }

    /// What a Session is doing. Independent of brand by contract: none of these may be Ion
    /// Blue, and no two of them may be near-neighbours.
    struct StateRoles: Sendable {
        /// A turn is in progress.
        public let running: ArgoColor
        /// Idle, and the completed/quiet end of the vocabulary. Deliberately not green.
        public let idle: ArgoColor
        /// Needs you — a permission prompt, a question, a reconnecting chip.
        public let attention: ArgoColor
        /// Failed, refused, errored. The only outcome that gets a colour.
        public let failure: ArgoColor

        public init(
            running: ArgoColor,
            idle: ArgoColor,
            attention: ArgoColor,
            failure: ArgoColor,
        ) {
            self.running = running
            self.idle = idle
            self.attention = attention
            self.failure = failure
        }

        public var all: [(name: String, color: ArgoColor)] {
            [
                ("running", running), ("idle", idle), ("attention", attention),
                ("failure", failure),
            ]
        }

        /// The same role at chip strength: a tinted ground rather than an ink.
        public func muted(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.16)
        }

        /// The same role as the EDGE of a surface rather than as an ink on it: the amber rim a
        /// Permission vessel wears. Half strength — louder than `muted`, which a word is read ON.
        public func rim(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.5)
        }

        /// The same role laid over a WHOLE surface while it invites something — the accent the
        /// composer takes with a file held over it (#540).
        ///
        /// Weaker than `muted`, and the third rung of the same family rather than a borrow from
        /// `DiffRoles.wash`: a chip's ground carries one word sized for it, and this one has to sit
        /// under a field, a picker and two controls that all stay readable through it. Measured
        /// against the approved render, `muted` at this size read as a panel laid over the vessel
        /// rather than as the vessel lit up.
        public func wash(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.1)
        }
    }

    /// What a change did to a file, as a pair of inks. The contract asserts their distance from
    /// `state`, which they share a feed with inches apart.
    struct DiffRoles: Sendable {
        public let added: ArgoColor
        public let removed: ArgoColor

        public init(added: ArgoColor, removed: ArgoColor) {
            self.added = added
            self.removed = removed
        }

        public var all: [(name: String, color: ArgoColor)] {
            [("added", added), ("removed", removed)]
        }

        /// The same role as a GROUND under a whole line of code rather than as an ink on it.
        /// Weaker than `StateRoles.muted`: source has to stay readable on it.
        public func wash(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.12)
        }
    }
}
