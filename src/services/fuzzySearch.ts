function fuzzyScore(word: string, text: string): number {
  if (!word || !text) return 0
  word = word.toLowerCase()
  text = text.toLowerCase()
  if (text === word) return 100
  if (text.startsWith(word)) return 80
  if (text.includes(word)) return 60

  let ti = 0
  let wi = 0
  for (; wi < word.length && ti < text.length; wi++) {
    let found = false
    while (ti < text.length) {
      if (text[ti] === word[wi]) { found = true; ti++; break }
      ti++
    }
    if (!found) return 0
  }
  return wi === word.length ? 40 : 0
}

export function fuzzySearchItems<T>(
  query: string,
  items: T[],
  textFn: (item: T) => string,
  maxResults = 20,
): T[] {
  if (!query || !items.length) return []

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const results: { item: T; score: number }[] = []

  for (const item of items) {
    const text = textFn(item).toLowerCase()
    let totalScore = 0
    for (const word of words) {
      const s = fuzzyScore(word, text)
      if (s === 0) { totalScore = 0; break }
      totalScore += s
    }
    if (totalScore > 0) {
      results.push({ item, score: totalScore })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, maxResults).map((r) => r.item)
}
