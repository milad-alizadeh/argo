// What one Roster pass reached, in the reader's words. Three facts, and a sentence each, because
// no single number carries them: how many transcript files Argo opened, how many it reached at
// all when the file cap stopped it short of the machine, and how many it reached and could not
// open. Folding damage into the read count states a file was read that was not, and folding a cap
// into damage reports a break that never happened (CONTEXT.md L1 · degrade down, never up).

export type ReadingCounts = {
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

// English counts one thing differently from several, and a note reading "1 unreadable lines" is a
// defect in the reader's eyes before it is a count.
export function counted(count: number, thing: string): string {
  return `${count} ${thing}${count === 1 ? '' : 's'}`
}

export function noteOnReading({ filesFound, filesRead, filesUnreadable }: ReadingCounts): string {
  const reached = filesRead + filesUnreadable
  const notes = [`Read ${counted(filesRead, 'transcript file')}.`]
  // The cap fired: a Roster off a machine holding 1,055 transcript files must not read as the
  // whole machine.
  if (reached < filesFound) notes.push(`Argo reached the ${reached} most recent of ${filesFound}.`)
  if (filesUnreadable > 0) notes.push(`${counted(filesUnreadable, 'file')} could not be opened.`)
  return notes.join(' ')
}
