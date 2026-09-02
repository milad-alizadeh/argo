import ArgoUI
import Foundation

/// The compartmented pair a class diagram and an entity diagram are (#865).
extension MermaidSpecimen {
    /// All six class relationships on one screen. THE specimen of #865: an open triangle is
    /// inheritance and a filled diamond is composition, and the pair the wrong way round would say
    /// the opposite of what its author meant and still look like a diagram.
    ///
    /// It is a chain, and it was written as one because a box could not then carry a marker at two
    /// of its own ends. `classFan` is the diagram that could not be drawn; this one is kept as it
    /// was, so what the fan changed for an ordinary class diagram is one render's difference
    /// (#920).
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
    /// A chain and not a hub, for the reason `classes` is one: it was written before a face could
    /// carry two ends. It stays a chain so the fan's effect on an ordinary entity diagram is
    /// legible as a difference rather than as a redrawn specimen (#920).
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

    /// Four relationships leaving ONE box by one face — two of them marked alike and two of them
    /// not. THE specimen of #920: a filled diamond means composition and a hollow one aggregation,
    /// different claims about ownership and lifetime, and stacked on a single midpoint the hollow
    /// one is simply not drawn. The reader then sees one relationship where two were written and
    /// reads the survivor's meaning onto both, which is the one place a diagram here draws
    /// confidently and wrongly rather than degrading down.
    ///
    /// The two triangles are the half that was always harmless — identical marks on one point read
    /// correctly — and they are here so the fan can be seen not to have cost them anything. No
    /// relationship carries a word: `classMembers` is where those are looked at, and four marks on
    /// one face is what this one is for.
    nonisolated static let classFan = """
    What a plan is made of, and who makes one:

    ```mermaid
    classDiagram
      class Diagram {
        +Plan laid
        +[Label] labels
      }
      Diagram <|-- Flowchart
      Diagram <|-- Compartmented
      Diagram *-- Figure
      Diagram o-- Caption
    ```
    """
}
