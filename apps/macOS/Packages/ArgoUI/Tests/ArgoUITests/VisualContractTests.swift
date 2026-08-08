@testable import ArgoUI
import Testing

/// The claims the contract makes about itself. They exist because every one of them is a
/// rule a future view or a future colour tweak could break silently: nothing about a hex
/// literal tells you it has drifted navy, or that a status has wandered into brand blue.
@Suite("Visual contract")
struct VisualContractTests {
    let palette = ArgoPalette.graphite

    // MARK: - The graphite ramp

    @Test
    func `the neutral ramp is grey, not navy`() {
        for surface in palette.surface.ramp {
            #expect(surface.chromaticSpread <= 0.05)
            #expect(surface.blue - surface.red <= 0.05)
        }
    }

    @Test
    func `the neutral ramp is near-black at its base`() {
        #expect(palette.surface.base.relativeLuminance < 0.02)
        #expect(palette.surface.sunken.relativeLuminance < palette.surface.base.relativeLuminance)
    }

    @Test
    func `the ramp rises step by step, so depth can be read off tone alone`() {
        let luminances = palette.surface.ramp.map(\.relativeLuminance)
        #expect(luminances == luminances.sorted())
        #expect(Set(luminances).count == luminances.count)
    }

    // MARK: - Ion Blue is brand, never status

    @Test
    func `no operational state resolves anywhere near the brand hue`() {
        for state in palette.state.all {
            #expect(state.distance(to: palette.interaction.accent) > 0.25)
        }
    }

    @Test
    func `selection and focus are the brand hue`() {
        #expect(palette.interaction.selectionIndicator == palette.interaction.accent)
        #expect(palette.interaction.focusRing == palette.interaction.accentBright)
    }

    @Test
    func `the selected row's wash is neutral — the brand is the indicator, not the fill`() {
        let wash = palette.surface.selected.composited(over: palette.surface.base)
        #expect(wash.chromaticSpread <= 0.05)
    }

    @Test
    func `no two operational states are near-neighbours`() {
        let states = palette.state.all
        for (index, state) in states.enumerated() {
            for other in states[(index + 1)...] {
                #expect(state.distance(to: other) > 0.25)
            }
        }
    }

    @Test
    func `idle is a neutral slate — finished work recedes, it does not celebrate`() {
        #expect(palette.state.idle.chromaticSpread <= 0.08)
    }

    // MARK: - Legibility

    @Test
    func `text roles clear their contrast floor on the deck`() {
        let base = palette.surface.base
        #expect(palette.text.primary.contrastRatio(on: base) >= 7)
        #expect(palette.text.secondary.contrastRatio(on: base) >= 4.5)
        #expect(palette.text.tertiary.contrastRatio(on: base) >= 4.5)
    }

    @Test
    func `every state ink and the accent stay legible as a word, not just as a dot`() {
        let base = palette.surface.base
        for ink in palette.state.all + [palette.interaction.accent] {
            #expect(ink.contrastRatio(on: base) >= 4.5)
        }
    }

    @Test
    func `text on an accent fill is legible`() {
        #expect(palette.text.onAccent.contrastRatio(on: palette.interaction.accent) >= 4.5)
    }

    // MARK: - Typography

    /// The identity roles are the two that used to carry a face of their own. They speak in the
    /// interface sans now: one sans for everything the interface says, one mono for machine facts.
    @Test
    func `identity lines are set in the interface sans, not a face of their own`() {
        let identityRoles = [ArgoTypography.sessionTitle, ArgoTypography.identityHeading]

        #expect(identityRoles.allSatisfy { $0.typeface == .interface })
    }

    @Test
    func `the mono is confined to machine facts`() {
        let machineRoles = ArgoTypography.all
            .filter { $0.style.typeface == .machine }
            .map(\.name)
        #expect(machineRoles == ["machine", "machineEmphasis", "machineCaption"])
    }

    @Test
    func `every role sits on the dense ladder the cockpit is built at`() {
        for role in ArgoTypography.all {
            #expect(role.style.size >= 10 && role.style.size <= 20)
        }
    }

    /// A symbol beside a label is drawn off the label's own line, from ONE contract value — the
    /// gap this closes is glyphs sitting proud of the type they belong to.
    @Test
    func `a glyph is drawn under its label's own size, never over it`() {
        // The scale is the contract and the roles only obey it. A mark at or above its label
        // stands proud of the line; one far under it reads as a speck beside the word.
        #expect(ArgoTypography.glyphScale < 1)
        #expect(ArgoTypography.glyphScale > 0.7)

        // No role gets to opt out — a glyph is always under the line it sits on, and the ladder
        // is preserved, so a bigger role never draws a smaller mark.
        let sizes = ArgoTypography.all.map(\.style)
        #expect(sizes.allSatisfy { $0.glyphSize < $0.size })
        #expect(sizes.sorted { $0.size < $1.size }.map(\.glyphSize) == sizes.map(\.glyphSize)
            .sorted())
    }

    // MARK: - The feed's rhythm

    @Test
    func `prose is set more openly than the rest of the cockpit is packed`() {
        // A feed is read rather than scanned, so its line height clears the dense default the
        // rest of the shell is built at. Below it, the column stops being a column of prose.
        #expect(ArgoFeedRow.lineHeight > ArgoTypography.body.size * ArgoFeedRow
            .naturalLineHeightRatio)
        #expect(ArgoFeedRow.proseLineSpacing > 0)
    }

    @Test
    func `the measure stays a reading measure, whatever the deck does`() {
        // Wide enough for the line not to feel clipped, and narrower than the feed column at the
        // WIDEST deck — the invariant the ticket exists for is that a wide window gets more feed
        // rather than a longer line.
        let widestUsefulFeed = ArgoLayout.windowMinimumWidth * 2 - ArgoLayout.agentsRailWidth
            - ArgoLayout.minimapLaneWidth
        #expect(ArgoFeedRow.measure > ArgoLayout.agentsRailWidth)
        #expect(ArgoFeedRow.measure < widestUsefulFeed)
    }

    @Test
    func `a prompt's bubble is a bubble, not the whole column`() {
        #expect(ArgoFeedRow.bubbleShare > 0.5)
        #expect(ArgoFeedRow.bubbleShare < 1)
        #expect(ArgoFeedRow.bubbleMeasure < ArgoFeedRow.measure)
    }

    @Test
    func `the step before prose is the tightest in the feed`() {
        // A label and the prose under it are one block; two rows are two. If those two steps ever
        // meet, the label starts reading as a row of its own.
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.gap)
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.inset)
    }

    @Test
    func `every feed metric is a step the rhythm already carries`() {
        // Except the two that are typographic rather than spatial: a line height and a reading
        // measure answer to the type ramp, and snapping them to the spacing ladder would be
        // arithmetic dressed as a rule.
        let ladder = Set(ArgoSpacing.all.map(\.value))
        #expect(ladder.isSuperset(of: [
            ArgoFeedRow.inset, ArgoFeedRow.gap, ArgoFeedRow.stepBeforeProse,
        ]))
    }

    // MARK: - Depth

    @Test
    func `only genuinely floating surfaces cast a shadow`() {
        let shadowed = ArgoElevation.all.filter(\.elevation.castsShadow).map(\.name)
        #expect(shadowed == ["popover", "dragged"])
    }

    @Test
    func `the shadows that exist stay soft`() {
        for rung in ArgoElevation.all {
            #expect(rung.elevation.opacity <= 0.45)
            #expect(rung.elevation.blur <= 28)
        }
    }

    // MARK: - Motion

    @Test
    func `no motion role outlasts feedback`() {
        for role in ArgoMotion.all {
            #expect(role.motion.duration <= ArgoMotion.durationCeiling)
        }
    }

    @Test
    func `the Reduce Motion variant never takes longer than the full one`() {
        for role in ArgoMotion.all {
            guard let reduced = role.motion.reducedDuration else { continue }
            #expect(reduced <= role.motion.duration)
        }
    }

    @Test
    func `every role resolves under Reduce Motion without a call site deciding`() {
        for role in ArgoMotion.all {
            let full = role.motion.resolved(reduceMotion: false)
            #expect(full != nil)
            // A nil reduced animation is a decision, not a gap: the change lands instantly.
            #expect(role.motion.resolved(reduceMotion: true) == nil || role.motion
                .reducedDuration != nil)
        }
    }
}
