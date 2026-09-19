export const DEVELOPMENT_SETUP_DOCUMENT_URL_ENV = 'ARGO_SETUP_DOCUMENT_DEVELOPMENT_URL'

const RAW_GITHUB_ORIGIN = 'https://raw.githubusercontent.com'
const ARGO_SETUP_DOCUMENT_PATH = 'packages/argo-skills/setup/project-setup.json'

export function githubSetupDocumentURL(ref) {
  const encodedRef = ref
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `${RAW_GITHUB_ORIGIN}/milad-alizadeh/argo/${encodedRef}/${ARGO_SETUP_DOCUMENT_PATH}`
}

export const ARGO_SETUP_DOCUMENT_URL = githubSetupDocumentURL('main')

export function developmentSetupDocumentURL(branch) {
  return branch ? githubSetupDocumentURL(branch) : null
}

export function developmentSetupDocumentEnvironment(branch) {
  const documentURL = developmentSetupDocumentURL(branch)
  return documentURL ? { [DEVELOPMENT_SETUP_DOCUMENT_URL_ENV]: documentURL } : {}
}

export function parseArgoSetupDocumentURL(value) {
  const parsed = new URL(value)
  if (
    parsed.origin !== RAW_GITHUB_ORIGIN ||
    !parsed.pathname.startsWith('/milad-alizadeh/argo/') ||
    !parsed.pathname.endsWith(`/${ARGO_SETUP_DOCUMENT_PATH}`)
  ) {
    return null
  }
  return parsed.href
}
