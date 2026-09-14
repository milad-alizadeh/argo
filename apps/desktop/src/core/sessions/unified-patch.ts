function changedLines(marker: '-' | '+', source: string) {
  return source
    .split('\n')
    .map((line) => `${marker}${line}`)
    .join('\n')
}

// Claude records old and new text separately; preserve every changed line in a unified patch.
export function unifiedPatch(oldText: string, newText: string) {
  const oldLines = oldText.split('\n').length
  const newLines = newText.split('\n').length
  return [
    `@@ -1,${oldLines} +1,${newLines} @@`,
    changedLines('-', oldText),
    changedLines('+', newText),
  ].join('\n')
}
