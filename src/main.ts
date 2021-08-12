import http from 'http'
import crypto from 'crypto'
import path from 'path'
import { Octokit } from '@octokit/core'
import Bot from './bot'

export default (
  workDir: string,
  port: number,
  projects: {
    owner: string,
    repo: string,
    actionName: string,
    artifactName: string
  }[],
  ghToken: string,
  webSecret: string,
  surgeToken: string
) => {
  const octokit = new Octokit({ auth: ghToken })
  const bots: { [path: string]: {
    bot: Bot,
    owner: string,
    repo: string,
    actionName: string,
    artifactName: string
  }} = {}
  projects.forEach((v) => {
    bots[`/${v.owner}/${v.repo}`] = {
      bot: new Bot(path.resolve(workDir, v.owner, v.repo), v.owner, v.repo, v.artifactName, octokit),
      owner: v.owner,
      repo: v.repo,
      actionName: v.actionName,
      artifactName: v.artifactName
    }
  })

  http.createServer((request, response) => {
    const reqUrl = request.url || '/'
    if (request.url === '/' && request.method === 'GET') {
      response.writeHead(200)
      response.write('200 OK:\nGood job!')
      response.end()
    } else if (!(reqUrl in bots)) {
      response.writeHead(404)
      response.write('404 Not Found:\nPage not found')
      response.end()
    } else if (request.method !== 'POST') {
      response.writeHead(405)
      response.write('405 Method Not Allowed:\nServer allows only POST method')
      response.end()
    } else {
      // eslint-disable-next-line no-var
      var body = ''
      request.on('data', (chunk) => {
        body = body + chunk
      })
      request.on('end', async () => {
        // console.log(crypto.createHmac('sha256', webSecret).update(body).digest('hex'))
        // console.log(body)
        // console.log(webSecret)
        if ('sha256=' + crypto.createHmac('sha256', webSecret).update(body).digest('hex') !== request.headers['x-hub-signature-256']) {
          response.writeHead(403)
          response.write('403 Forbidden:\nFailed to verify signature')
          response.end()
        } else {
          response.writeHead(200)
          response.write('200 OK:\nGood job!')
          response.end()
        }
      })
    }
  }).listen(port)

  console.log(`Server started, listening ${port}`)
}
