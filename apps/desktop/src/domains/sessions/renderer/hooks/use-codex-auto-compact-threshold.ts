// The renderer holds no threshold state of its own: it shows what the main process read from
// `~/.codex/config.toml`, and asks it to write a new one (agents/codex/compaction/bridge.ts).
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_AUTO_COMPACT_LIMIT } from '../../../../agents/codex/compaction/compaction'

export function useCodexAutoCompactThreshold(): [number, (limit: number) => void] {
  const [limit, setLimit] = useState(DEFAULT_AUTO_COMPACT_LIMIT)

  useEffect(() => {
    void window.argo.getCodexAutoCompactLimit().then(setLimit)
  }, [])

  const choose = useCallback((chosen: number) => {
    void window.argo.setCodexAutoCompactLimit(chosen).then(setLimit)
  }, [])

  return [limit, choose]
}
