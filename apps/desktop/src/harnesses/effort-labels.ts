import { platformText } from '@/platform/main/i18n'

// Every adapter names a reasoning effort in these shared words, so each Harness draws one level alike.
const effortLabels: Record<string, string> = {
  low: platformText('harnessCatalog.effort.low'),
  medium: platformText('harnessCatalog.effort.medium'),
  high: platformText('harnessCatalog.effort.high'),
  xhigh: platformText('harnessCatalog.effort.xhigh'),
  max: platformText('harnessCatalog.effort.max'),
  ultra: platformText('harnessCatalog.effort.ultra'),
}

export function effortLabel(value: string): string {
  return effortLabels[value] ?? value
}
