import ArgoUI
import Foundation

/// The charts a pie layout has to get right (#864).
extension MermaidSpecimen {
    /// Eight slices — the whole series run, so every hue is judged beside the hue it is drawn
    /// next to — with values that sum to nothing round, and `showData` writing them out (#864).
    nonisolated static let pie = """
    Where a week of turns actually went:

    ```mermaid
    pie showData title Where the week went
      "Reading the ticket" : 42.5
      "Writing the code" : 31
      "Waiting on CI" : 18.25
      "Reviewing" : 15
      "Rebasing" : 9
      "Rendering specimens" : 7.5
      "Arguing about names" : 6
      "Landing it" : 3
    ```
    """

    /// The chart that breaks the arithmetic: one slice, which is a whole circle and a legend of
    /// one row, under a title wider than the figure it names.
    nonisolated static let pieSingle = """
    Everything, in one place:

    ```mermaid
    pie title One slice is still a circle
      "The only thing that happened" : 1
    ```
    """
}
