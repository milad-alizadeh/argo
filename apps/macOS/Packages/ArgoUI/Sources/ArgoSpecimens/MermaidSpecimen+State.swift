import ArgoUI
import Foundation

/// The shapes of machine a state diagram has to get right (#863).
extension MermaidSpecimen {
    /// A flat machine: both ends of `[*]`, a described state, and a word on every transition — the
    /// one screen that shows the same token drawn as two different figures (#863).
    nonisolated static let state = """
    What a ticket's own session does, start to finish:

    ```mermaid
    stateDiagram-v2
      [*] --> Reading
      Reading --> Building : the plan is agreed
      state "Waiting for CI" as wait
      Building --> wait : pushed
      wait --> Building : red
      wait --> [*] : green
      note right of wait : the runner holds it
    ```
    """

    /// A composite, with its own start inside it and a state outside the frame must not close over.
    nonisolated static let stateComposite = """
    The build, opened up:

    ```mermaid
    stateDiagram-v2
      [*] --> Working
      state Working {
        [*] --> Reading
        Reading --> Writing
        Writing --> Testing
      }
      Working --> Landed
      Landed --> [*]
    ```
    """

    /// A choice and a fork on one screen, which is the pair a reader has to tell apart at a glance.
    nonisolated static let stateChoice = """
    Where a review branches, and where it fans out:

    ```mermaid
    stateDiagram-v2
      direction LR
      [*] --> Review
      state pick <<choice>>
      Review --> pick
      pick --> Changes : findings
      pick --> split : approved
      state split <<fork>>
      split --> Merge
      split --> Notify
      Changes --> Review
    ```
    """
}
