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
    /// Every appearance the app ships.
    ///
    /// The contract's assertions run over this rather than over `graphite` by name, so a second
    /// palette inherits every legibility floor and every hue-rationing rule the day it is added
    /// — rather than the day somebody remembers to copy a test.
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
        /// The neutral wash a selected row carries. Selection is neutral here on purpose —
        /// the Ion Blue of selection is the indicator edge, not the fill.
        public let selected: ArgoColor
        /// The ground something laid OVER the deck is read against — a picture opened full size.
        /// Near-opaque rather than a tint: what is behind it is not being read, and a feed
        /// half-visible under a photograph is two surfaces competing for the same eye. Not a step
        /// of the ramp, so it is not in it: depth is read off the ramp, and this covers it.
        public let scrim: ArgoColor
        /// The ground under a run of text marked as machine text — a `code` span mid-sentence.
        ///
        /// A ground rather than an ink, because the span is a KIND of text and not a state, and
        /// this palette rations hue for meaning: brand, four operational states, two diff inks.
        /// The mono face already says "machine"; what it cannot do is make the run findable in a
        /// paragraph, and that is this role's whole job.
        ///
        /// Translucent by contract, and that is the load-bearing part: the same span is read on
        /// the deck AND inside a prompt's raised bubble, so a ground that composites keeps its
        /// separation on both while an opaque one would vanish on one of them.
        public let marked: ArgoColor

        public init(
            sunken: ArgoColor,
            base: ArgoColor,
            raised: ArgoColor,
            overlay: ArgoColor,
            glassTint: ArgoColor,
            hover: ArgoColor,
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
            self.selected = selected
            self.scrim = scrim
            self.marked = marked
        }

        /// The ramp in depth order, for contract assertions and the specimen.
        public var ramp: [ArgoColor] {
            [sunken, base, raised, overlay]
        }

        /// Every role, for the specimen and the coverage test. Depth order first, then the
        /// grounds that are not steps of the ramp.
        public var all: [(name: String, color: ArgoColor)] {
            [
                ("sunken", sunken), ("base", base), ("raised", raised), ("overlay", overlay),
                ("glassTint", glassTint), ("hover", hover), ("selected", selected),
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
        /// roster row. Red because the reader has to weigh it before letting go, which is not
        /// something the brand hue can say.
        ///
        /// Its own role rather than a borrow from `state.failure`, and held a clear distance from
        /// it, for the reason `DiffRoles` gives: the two appear inches apart on one roster row, and
        /// "this will take the Session off the list" and "this Session failed" are not one fact.
        /// A ground, besides, where `failure` is an ink — deep enough to carry `text.primary`.
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
    }

    /// What a Session is doing. Independent of brand by contract: none of these may be Ion
    /// Blue, and no two of them may be near-neighbours.
    struct StateRoles: Sendable {
        /// A turn is in progress.
        public let running: ArgoColor
        /// Idle, and the completed/quiet end of the vocabulary. Deliberately not green: finished
        /// work should recede, not celebrate. That holds for a single call as much as for a
        /// Session — a feed of green ticks is a feed with nothing standing out in it.
        public let idle: ArgoColor
        /// Needs you — a permission prompt, a question, a reconnecting chip.
        public let attention: ArgoColor
        /// Failed, refused, errored. The one outcome that gets a colour, because it is the one
        /// worth finding down a long feed.
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
    }

    /// What a change did to a file, as a pair of inks.
    ///
    /// Their own roles rather than a borrow from `state`: a diffstat and a running dot sit in the
    /// same feed, inches apart, and "this line was added" and "this Session is working" are not one
    /// fact. The contract asserts the distance so the borrow cannot creep back in.
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
        /// Weaker than a status chip's tint (`StateRoles.muted`): a chip's ground carries a word
        /// sized for it, and this one has to sit under source that stays readable on it.
        public func wash(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.12)
        }
    }
}
