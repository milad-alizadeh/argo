import Foundation

/// The compartmented pair a class diagram and an entity diagram are (#865).
extension MermaidSpecimen {
    /// All six class relationships on one screen. THE specimen of this ticket: an open triangle is
    /// inheritance and a filled diamond is composition, and the pair the wrong way round would say
    /// the opposite of what its author meant and still look like a diagram.
    ///
    /// No box carries a marker at TWO of its own ends. Every edge leaves a box by the middle of one
    /// face, so two marked ends on one box are drawn on top of each other — and the one underneath
    /// is the one a reviewer cannot see. Fanning the exits is a change to the shared pass and to
    /// every diagram type on it (#861), so this diagram is written around it instead.
    nonisolated static let classes = """
    How a `mermaid` fence becomes a drawn diagram:

    ```mermaid
    classDiagram
      class Reader {
        <<interface>>
        +read(String) Diagram
      }
      Reader <|.. ClassReader
      ClassReader --|> Compartmented
      ClassReader --> Diagram
      ClassReader ..> Terminal
      Diagram *-- Box
      Box o-- Relation
    ```
    """

    /// The compartments themselves: visibility on every member, methods ruled off the attributes,
    /// an annotation above the name, a generic in both places one can be written, and a cardinality
    /// against each end of a relationship.
    nonisolated static let classMembers = """
    What a session holds, and what holds sessions:

    ```mermaid
    classDiagram
      class Session {
        <<interface>>
        +String identifier
        -Date started
        #Status status
        ~Project owner
        +resume() Session
        +stop() void
      }
      class Store~Session~ {
        +List~Session~ held
        +add(Session) void
      }
      Store~Session~ "1" --> "0..*" Session : holds
      Session "1" o-- "*" Turn : ran
    ```
    """

    /// Every zero/one/many combination, an identifying relationship beside a non-identifying
    /// one, and attributes carrying their key markers.
    ///
    /// A chain and not a hub, for the reason `classes` is written the way it is: two relationships
    /// meeting one entity by the same face draw their cardinalities on top of each other.
    nonisolated static let entities = """
    What Argo stores, and how the rows hang together:

    ```mermaid
    erDiagram
      PROJECT ||--o{ SESSION : runs
      SESSION ||--|{ TURN : records
      TURN |o..o| OUTCOME : "settles as"
      PROJECT {
        string identifier PK
        string path UK
        string name "shown in the roster"
      }
      SESSION {
        string identifier PK
        string project FK
        string status
      }
      TURN {
        int ordinal PK
        string stopReason
      }
      OUTCOME {
        string identifier PK
        string branch
      }
    ```
    """
}
