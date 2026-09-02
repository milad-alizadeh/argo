import ArgoEngine
import ArgoUI

package extension DeviceCodeCopy {
    /// Every word the waiting card can draw, for the copy sweep to walk. Here rather than beside
    /// the copy it gathers: the two challenge shapes it needs come from a fixture, and ArgoUI may
    /// not reach one (#1085).
    static let all = [copy, copied, stop, waiting]
        + AccountProvider.allCases.flatMap { provider in
            [ConnectFixture.typed(provider), ConnectFixture.redirected(provider)]
                .flatMap { [heading(for: $0), address(of: $0), spoken($0)] }
        }
}
