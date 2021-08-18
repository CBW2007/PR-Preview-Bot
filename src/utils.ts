import { URL } from 'url'

export function genComment (
  siteUrl: string,
  siteStat: 'Online' | 'Offline' | 'Not Latest' | 'Failure',
  serverStat: 'Preparing Latest Build' | 'Locked' | '',
  commit?: string
): string {
  let content = ''
  content += '**PR preview bot**\n'
  content += '* * *\n'
  content += `**Site Url:** <${siteUrl}>\n`
  // eslint-disable-next-line no-var
  var color = ''
  if (serverStat === 'Preparing Latest Build') {
    color = 'yellow'
  } else if (siteStat === 'Online') {
    color = 'succes'
  } else if (siteStat === 'Not Latest') {
    color = 'blue'
  } else if (siteStat === 'Failure') {
    color = 'critical'
  } else if (siteStat === 'Offline') {
    color = 'inactive'
  }
  const imageUrl = new URL(`https://img.shields.io/static/v1?label=Preview&message=${siteStat}${serverStat ? `, ${serverStat}` : ''}(cur:${commit ? commit.slice(0, 6) : '---'})&color=${color}&style=flat-square`).toString()
  content += `**Status:** ![](${imageUrl})\n`
  return content
}
