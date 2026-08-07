import SwiftUI

/// The window's content. It renders nothing on purpose: the window, its chrome and its
/// material are what there is to see at this point.
public struct CockpitView: View {
    public init() {}

    public var body: some View {
        Color.clear
            .frame(minWidth: 720, minHeight: 480)
    }
}
