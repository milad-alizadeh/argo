import SwiftUI

extension View {
    /// Wraps a custom `List` row in a container. A row placed directly inside a `List`'s
    /// `ForEach` crashes the macOS canvas in `TableViewListCore_Mac2` — an Xcode bug, and
    /// this is the workaround Apple DTS accept (forums thread 803429). Previews only; it has
    /// never crashed at runtime.
    func previewSafeListRow() -> some View {
        ZStack { self }
    }
}
