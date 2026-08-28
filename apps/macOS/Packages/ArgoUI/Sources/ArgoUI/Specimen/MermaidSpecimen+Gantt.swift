import Foundation

/// The four things a Gantt layout has to get right (#903, #904).
extension MermaidSpecimen {
    /// A multi-section chart across a quarter, in both of the absolute task forms and carrying
    /// ids: the hues have to separate the sections, and the dates over the bars have to stay off
    /// one another.
    nonisolated static let gantt = """
    How the mermaid epic actually ran:

    ```mermaid
    gantt
      title The mermaid epic, quarter by quarter
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      section Reading
        The flowchart reader :flow, 2026-01-05, 3w
        The sequence reader  :seq, 2026-01-26, 2w
        The pie and quadrant :pie, 2026-02-09, 12d
      section Drawing
        The layered pass     :lay, 2026-01-19, 2026-02-16
        The time axis        :axis, 2026-02-21, 2w
      section Landing
        Review and rebase    :rev, 2026-03-07, 10d
        The epic closes      :close, 2026-03-17, 5d
    ```
    """

    /// One working day, hour by hour — where a tick step fixed at a day would draw one mark and
    /// call it an axis.
    nonisolated static let ganttDay = """
    One day of it, hour by hour:

    ```mermaid
    gantt
      title A day on the axis ticket
      dateFormat YYYY-MM-DD HH:mm
      axisFormat %H:%M
      section Morning
        Read the ticket  : 2026-02-21 09:00, 2026-02-21 10:30
        Write the reader : 2026-02-21 10:30, 3h
      section Afternoon
        The tick walk    : 2026-02-21 14:00, 4h
        Render and look  : 2026-02-21 18:00, 1h
    ```
    """

    /// A decade, where a tick a day would be a smear: the same source, marked at a step that fits.
    nonisolated static let ganttYears = """
    And the long view:

    ```mermaid
    gantt
      title A decade of it
      dateFormat YYYY-MM-DD
      axisFormat %Y
      section The long run
        The first attempt : 2016-01-01, 2019-06-30
        The rewrite       : 2019-07-01, 2023-12-31
        The one that shipped : 2024-01-01, 2026-06-30
    ```
    """

    /// A chain and a week of weekends (#904): every task but the first is placed by the one above
    /// it, the bars break around the days off, and `The bars` was told to start on a Saturday.
    nonisolated static let ganttChain = """
    And how it would run with the weekends off:

    ```mermaid
    gantt
      title The epic, weekends off
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      excludes weekends
      section Reading
        The reader :read, 2026-01-01, 5d
        The dates  :dates, after read, 3d
      section Drawing
        The axis   :axis, after dates, 4d
        The bars   :bars, after axis, 2d
      section Landing
        Review     :rev, after bars, 3d
    ```
    """
}
