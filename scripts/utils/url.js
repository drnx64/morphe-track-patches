/**
 * URL utilities — repo info, author links, Play Store URLs.
 */

export function getRepoInfo(repoUrl) {
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

export function getAuthorLink(repoUrl) {
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

export function getAddMorpheUrl(repoUrl) {
  const info = getRepoInfo(repoUrl)
  const param = info.isGitLab ? 'gitlab' : 'github'
  return `https://morphe.software/add-source?${param}=${encodeURIComponent(info.path)}`
}

export function getPlayStoreUrl(packageName) {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`
}
