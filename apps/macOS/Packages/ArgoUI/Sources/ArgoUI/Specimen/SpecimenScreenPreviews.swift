import SwiftUI

// The canvas entries for `SpecimenScreen`, kept apart from the screen that serves them. They are a
// selection, not the registry: `SpecimenRegistry` is what `--specimen` and `scripts/specimens.sh`
// read, and these are the handful worth having open while editing the surface they draw.
//
// A name no entry answers to draws an empty canvas, which is the whole blast radius: the app's own
// resolution is `ArgoApp`'s, and the registry's names are checked by `SpecimenRegistryTests`.

#Preview("Specimen — the deck") {
    SpecimenRegistry.entry(named: "deck").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the Sessions deck container") {
    SpecimenRegistry.entry(named: "sessionsDeck").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the feed at rest") {
    SpecimenRegistry.entry(named: "feed").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the work, as sentence-shaped lines") {
    SpecimenRegistry.entry(named: "feedCalls").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a run of pictures in the feed") {
    SpecimenRegistry.entry(named: "feedGallery").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a shot opened full size") {
    SpecimenRegistry.entry(named: "feedLightbox").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan above the dock") {
    SpecimenRegistry.entry(named: "planPill").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan's whole list") {
    SpecimenRegistry.entry(named: "openPlanPill").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a Codex feed, where nothing narrates a command") {
    SpecimenRegistry.entry(named: "feedCommands").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

// The same commands at the narrowest deck a 960-point window produces. The width is part of the
// state: a shortened command's whole promise is that its row stays one line where there is least
// room for it.
#Preview("Specimen — a Codex feed at the narrowest deck") {
    SpecimenRegistry.entry(named: "feedCommands").map(SpecimenScreen.init(entry:))
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}

#Preview("Specimen — a session at the length a real one reaches") {
    SpecimenRegistry.entry(named: "feedAtScale").map(SpecimenScreen.init(entry:))
        .frame(width: 1000, height: 620)
}

// The narrowest deck a 960-point window can produce, with both columns in it. The width is part of
// the state: this is the one place the reading and the panel have to share 680 points.
#Preview("Specimen — a long feed at the narrowest deck, panel open") {
    SpecimenRegistry.entry(named: "feedAtScaleEvidence").map(SpecimenScreen.init(entry:))
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}
