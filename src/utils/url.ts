import type { RepoInfo } from '../types/utils'

export function getRepoInfo(repoUrl?: string): RepoInfo {
  if (!repoUrl) return { isGitLab: false, path: '' }
  const isGitLab = repoUrl.includes('gitlab.com')
  let path = ''
  if (isGitLab) {
    const m = repoUrl.match(/https:\/\/gitlab\.com\/(.+)/)
    if (m) path = m[1].replace(/\.git$/, '').replace(/\/+$/, '')
  } else {
    const m = repoUrl.match(/https:\/\/github\.com\/([^/]+\/[^/]+)/)
    if (m) path = m[1].replace(/\.git$/, '')
  }
  return { isGitLab, path }
}

export function getAuthorLink(repoUrl?: string): string {
  if (!repoUrl) return 'unknown'
  const gitlabMatch = repoUrl.match(/https:\/\/gitlab\.com\/([^/]+)/)
  if (gitlabMatch) {
    const author = gitlabMatch[1]
    return `<a href="https://gitlab.com/${author}" target="_blank" class="author-link">@${author}</a>`
  }
  const match = repoUrl.match(/https:\/\/github\.com\/([^/]+)/)
  if (match) {
    const author = match[1]
    return `<a href="https://github.com/${author}" target="_blank" class="author-link">@${author}</a>`
  }
  return 'unknown'
}

export function getAddMorpheUrl(repoUrl?: string): string {
  const info = getRepoInfo(repoUrl)
  const param = info.isGitLab ? 'gitlab' : 'github'
  return `https://morphe.software/add-source?${param}=${encodeURIComponent(info.path)}`
}

export function getPlayStoreUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`
}
