import './running-loader-gallery-prototype.css'
import './running-loader-orbital-prototype.css'
import './running-loader-linear-prototype.css'
import './running-loader-geometric-prototype.css'
import './running-loader-signal-prototype.css'

export const SIGNATURE_LOADERS = [
  { key: 'comet', name: 'Comet', family: 'Orbital' },
  { key: 'crescent', name: 'Crescent', family: 'Orbital' },
  { key: 'twin-arc', name: 'Twin arc', family: 'Orbital' },
  { key: 'orbit', name: 'Orbit', family: 'Orbital' },
  { key: 'radar', name: 'Radar', family: 'Orbital' },
  { key: 'sweep', name: 'Sweep', family: 'Linear' },
  { key: 'shuttle', name: 'Shuttle', family: 'Linear' },
  { key: 'ping', name: 'Ping', family: 'Linear' },
  { key: 'scan', name: 'Scan', family: 'Linear' },
  { key: 'morse', name: 'Morse', family: 'Linear' },
  { key: 'diamond', name: 'Diamond', family: 'Geometric' },
  { key: 'flip', name: 'Flip', family: 'Geometric' },
  { key: 'twin-diamond', name: 'Twin diamond', family: 'Geometric' },
  { key: 'pendulum', name: 'Pendulum', family: 'Geometric' },
  { key: 'fold', name: 'Fold', family: 'Geometric' },
  { key: 'braid', name: 'Braid', family: 'Signal' },
  { key: 'wave', name: 'Wave', family: 'Signal' },
  { key: 'matrix', name: 'Matrix', family: 'Signal' },
  { key: 'chevrons', name: 'Chevrons', family: 'Signal' },
  { key: 'cursor', name: 'Cursor', family: 'Signal' },
] as const

export type SignatureLoaderKey = (typeof SIGNATURE_LOADERS)[number]['key']

export function isSignatureLoaderKey(value: string | null): value is SignatureLoaderKey {
  return SIGNATURE_LOADERS.some((loader) => loader.key === value)
}

export function SignatureRunningLoader({ loader }: { loader: SignatureLoaderKey }) {
  return (
    <span aria-hidden="true" className="signature-loader" data-loader={loader}>
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}
