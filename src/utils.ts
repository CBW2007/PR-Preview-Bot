const statusMap = [
  { msg: 'Preparing', color: 'yellow' }, // 0
  { msg: 'Online', color: 'succes' } // 1
]

export function generateComment (siteUrl: string, status: number, commit?: string): string {
  let content = ''
  content += '**PR preview bot**\n'
  content += '* * *\n'
  content += `**Site Url:** <${siteUrl}>\n`
  content += `**Status:** ![](https://img.shields.io/static/v1?label=Preview&message=${statusMap[status].msg}${(commit) ? `(${commit.slice(0, 6)})` : ''}&color=${statusMap[status].color}&style=flat-square)\n`
  return content
}
