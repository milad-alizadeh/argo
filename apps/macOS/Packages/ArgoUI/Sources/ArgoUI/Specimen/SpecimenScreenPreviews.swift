import SwiftUI

// The canvas entries for `SpecimenScreen`, kept apart from the router that serves them. They are a
// selection, not the catalog: `SpecimenCatalog` is what `--specimen` and `scripts/specimens.sh`
// read, and these are the handful worth having open while editing the surface they draw.

#Preview("Specimen — the deck") {
    SpecimenScreen(specimen: .deck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the Sessions deck container") {
    SpecimenScreen(specimen: .sessionsDeck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the feed at rest") {
    SpecimenScreen(specimen: .feed)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the work, as sentence-shaped lines") {
    SpecimenScreen(specimen: .feedCalls)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a run of pictures in the feed") {
    SpecimenScreen(specimen: .feedGallery)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a shot opened full size") {
    SpecimenScreen(specimen: .feedLightbox)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan above the dock") {
    SpecimenScreen(specimen: .planPill)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan's whole list") {
    SpecimenScreen(specimen: .openPlanPill)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a Codex feed, where nothing narrates a command") {
    SpecimenScreen(specimen: .feedCommands)
        .frame(width: 1000, height: 620)
}

// The same commands at the narrowest deck a 960-point window produces. The width is part of the
// state: a shortened command's whole promise is that its row stays one line where there is least
// room for it.
#Preview("Specimen — a Codex feed at the narrowest deck") {
    SpecimenScreen(specimen: .feedCommands)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}

#Preview("Specimen — a session at the length a real one reaches") {
    SpecimenScreen(specimen: .feedAtScale)
        .frame(width: 1000, height: 620)
}

// The narrowest deck a 960-point window can produce, with both columns in it. The width is part of
// the state: this is the one place the reading and the panel have to share 680 points.
#Preview("Specimen — a long feed at the narrowest deck, panel open") {
    SpecimenScreen(specimen: .feedAtScaleEvidence)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}
