// How many transcript files one Roster pass reads, most recently written first, on a cold cursor.
// A later request grows the window by the same step rather than reading the rest of the tree.
// Measured on a real tree of 1,055 files holding 3.3 GB: streaming 50 of them costs about 0.4 s,
// 200 about 1.6 s. The count is stated on the reply rather than hidden, so a Roster that did not
// reach every file says so instead of reading as the whole machine.
export const ROSTER_PAGE_SIZE = 50
