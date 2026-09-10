export function parseCsv(text) {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = withoutBom.split(/\r?\n/).filter((line) => line.length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(';')
  return lines.slice(1).map((line) => {
    const values = line.split(';')
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    return row
  })
}

export function formatSapDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  const year = yyyymmdd.slice(0, 4)
  const month = yyyymmdd.slice(4, 6)
  const day = yyyymmdd.slice(6, 8)
  return `${year}-${month}-${day}`
}
