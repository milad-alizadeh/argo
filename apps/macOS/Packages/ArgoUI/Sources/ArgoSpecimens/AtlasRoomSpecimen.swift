import ArgoDesign
import ArgoUI
import SwiftUI

/// The Atlas room over a measured Map: the treemap of a repository, plate by plate, banded by the
/// traffic light (#1148).
///
/// The map is a REAL measurement, trimmed — the same shape the generator writes, rather than tidy
/// numbers. A treemap tested only on round figures is a treemap that breaks on the first
/// repository: what has to survive is one file 78× the median beside a dozen that measure nothing.
struct AtlasRoomSpecimen: View {
    var body: some View {
        AtlasRoomHost(map: AtlasRoomSpecimenMap.trimmed)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The room's other reading, on the same sheet's terms: a Project nobody has measured, which is an
/// instruction rather than an empty screen.
struct AtlasRoomVacancySpecimen: View {
    var body: some View {
        AtlasRoomHost(map: nil)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

#Preview("Atlas room, a generated atlas") {
    AtlasRoomSpecimen()
        .frame(width: 1080, height: 720)
        .argoAppearance()
}
