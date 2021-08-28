import { URL } from 'url'
import crypto from 'crypto'

const color = {
  // Site Status Color
  Online: 'succes',
  Offline: 'inactive',
  'Not Latest': 'important',

  // Server Status Color
  Ready: 'succes',
  Preparing: 'yellow',
  Crashed: 'critical',
  Closed: 'inactive'
}

export type SiteStat = 'Online' | 'Offline' | 'Not Latest'
export type ServerStat = 'Ready' | 'Preparing' | 'Crashed' | 'Closed'

export function genComment (
  siteUrl: string,
  siteStat: SiteStat,
  serverStat: ServerStat,
  commit: string
): string {
  let content = ''
  content += '**PR preview bot**\n'
  content += '* * *\n'
  content += `**Site Url:** <${siteUrl}>\n`
  const siteStatImage = new URL(`https://img.shields.io/static/v1?label=Site&message=${siteStat}(cur:${commit ? commit.slice(0, 6) : '---'})&color=${color[siteStat]}&style=flat-square`).toString()
  const serverStatImage = new URL(`https://img.shields.io/static/v1?label=Server&message=${serverStat}&color=${color[serverStat]}&style=flat-square`).toString()
  content += `**Status:** ![](${siteStatImage}) ![](${serverStatImage})\n`
  return content
}

export function md5 (src: string): string {
  return crypto.createHash('md5').update(src).digest('hex')
}
