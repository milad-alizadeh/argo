import Testing

@testable import ArgoUI

/// The claims the contract makes about itself. They exist because every one of them is a
/// rule a future view or a future colour tweak could break silently: nothing about a hex
/// literal tells you it has drifted navy, or that a status has wandered into brand blue.
@Suite("Visual contract")
struct VisualContractTests {
    let palette = ArgoPalette.graphite

    // MARK: - The graphite ramp

    @Test("the neutral ramp is grey, not navy")
    func neutralRampIsGrey() {
        for surface in palette.surface.ramp {
            #expect(surface.chromaticSpread <= 0.05)
            #expect(surface.blue - surface.red <= 0.05)
        }
    }

    @Test("the neutral ramp is near-black at its base")
    func neutralRampIsNearBlack() {
        #expect(palette.surface.base.relativeLuminance < 0.02)
        #expect(palette.surface.sunken.relativeLuminance < palette.surface.base.relativeLuminance)
    }

    @Test("the ramp rises step by step, so depth can be read off tone alone")
    func rampIsMonotonic() {
        let luminances = palette.surface.ramp.map(\.relativeLuminance)
        #expect(luminances == luminances.sorted())
        #expect(Set(luminances).count == luminances.count)
    }

    // MARK: - Ion Blue is brand, never status

    @Test("no operational state resolves anywhere near the brand hue")
    func statesAreNotBrand() {
        for state in palette.state.all {
            #expect(state.distance(to: palette.interaction.accent) > 0.25)
        }
    }

    @Test("selection and focus are the brand hue")
    func selectionAndFocusAreBrand() {
        #expect(palette.interaction.selectionIndicator == palette.interaction.accent)
        #expect(palette.interaction.focusRing == palette.interaction.accentBright)
    }

    @Test("the selected row's wash is neutral — the brand is the indicator, not the fill")
    func selectionWashIsNeutral() {
        let wash = palette.surface.selected.composited(over: palette.surface.base)
        #expect(wash.chromaticSpread <= 0.05)
    }

    @Test("no two operational states are near-neighbours")
    func statesAreMutuallyDistinct() {
        let states = palette.state.all
        for (index, state) in states.enumerated() {
            for other in states[(index + 1)...] {
                #expect(state.distance(to: other) > 0.25)
            }
        }
    }

    @Test("idle is a neutral slate — finished work recedes, it does not celebrate")
    func idleIsNeutral() {
        #expect(palette.state.idle.chromaticSpread <= 0.08)
    }

    // MARK: - Legibility

    @Test("text roles clear their contrast floor on the deck")
    func textIsLegible() {
        let base = palette.surface.base
        #expect(palette.text.primary.contrastRatio(on: base) >= 7)
        #expect(palette.text.secondary.contrastRatio(on: base) >= 4.5)
        #expect(palette.text.tertiary.contrastRatio(on: base) >= 4.5)
    }

    @Test("every state ink and the accent stay legible as a word, not just as a dot")
    func stateInksAreLegible() {
        let base = palette.surface.base
        for ink in palette.state.all + [palette.interaction.accent] {
            #expect(ink.contrastRatio(on: base) >= 4.5)
        }
    }

    @Test("text on an accent fill is legible")
    func textOnAccentIsLegible() {
        #expect(palette.text.onAccent.contrastRatio(on: palette.interaction.accent) >= 4.5)
    }

    // MARK: - Typography

    @Test("the serif is confined to identity")
    func serifIsConfinedToIdentity() {
        let identityRoles = ArgoTypography.all
            .filter { $0.style.typeface == .identity }
            .map(\.name)
        #expect(identityRoles == ["sessionTitle", "identityHeading"])
    }

    @Test("the mono is confined to machine facts")
    func monoIsConfinedToMachineFacts() {
        let machineRoles = ArgoTypography.all
            .filter { $0.style.typeface == .machine }
            .map(\.name)
        #expect(machineRoles == ["machine", "machineEmphasis", "machineCaption"])
    }

    @Test("every role sits on the dense ladder the cockpit is built at")
    func sizesStayDense() {
        for role in ArgoTypography.all {
            #expect(role.style.size >= 10 && role.style.size <= 20)
        }
    }

    // MARK: - Depth

    @Test("only genuinely floating surfaces cast a shadow")
    func shadowIsRationed() {
        let shadowed = ArgoElevation.all.filter(\.elevation.castsShadow).map(\.name)
        #expect(shadowed == ["popover", "dragged"])
    }

    @Test("the shadows that exist stay soft")
    func shadowsStaySoft() {
        for rung in ArgoElevation.all {
            #expect(rung.elevation.opacity <= 0.45)
            #expect(rung.elevation.blur <= 28)
        }
    }

    // MARK: - Motion

    @Test("no motion role outlasts feedback")
    func motionIsBrief() {
        for role in ArgoMotion.all {
            #expect(role.motion.duration <= ArgoMotion.durationCeiling)
        }
    }

    @Test("the Reduce Motion variant never takes longer than the full one")
    func reducedMotionIsNeverSlower() {
        for role in ArgoMotion.all {
            guard let reduced = role.motion.reducedDuration else { continue }
            #expect(reduced <= role.motion.duration)
        }
    }

    @Test("Reduce Motion resolves for every role without a call site deciding")
    func reducedMotionIsDefinedForEveryRole() {
        for role in ArgoMotion.all {
            let full = role.motion.resolved(reduceMotion: false)
            #expect(full != nil)
            // A nil reduced animation is a decision, not a gap: the change lands instantly.
            #expect(role.motion.resolved(reduceMotion: true) == nil || role.motion.reducedDuration != nil)
        }
    }
}
