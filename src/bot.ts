import fs from 'fs'
import path from 'path'
import ChildProcess from 'child_process'
import { Octokit } from '@octokit/core'
import extract from 'extract-zip'
import { genComment, md5, SiteStat, ServerStat } from './utils'

export default class {
  workDir: string
  owner: string
  repo: string
  artifactName: string
  octokit: Octokit
  surgeToken: string
  db: {
    pulls: {
      [pr: string]: {
        commentId: number,
        commentBody: string,
        siteCommit: string,
        headCommit: string
      }
    }
  }

  constructor (workDir:string, owner: string, repo: string, artifact: string, octokit: Octokit, surgeToken: string) {
    this.workDir = workDir
    this.owner = owner
    this.repo = repo
    this.artifactName = artifact
    this.octokit = octokit
    this.surgeToken = surgeToken
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true })
    if (!fs.existsSync(path.resolve(this.workDir, 'db.json'))) fs.writeFileSync(path.resolve(this.workDir, 'db.json'), JSON.stringify({ pulls: {} }))
    this.db = JSON.parse(fs.readFileSync(path.resolve(this.workDir, 'db.json')).toString())
  }

  async syncDb (): Promise<void> {
    fs.writeFileSync(path.resolve(this.workDir, 'db.json'), JSON.stringify(this.db))
  }

  async updComment (pr: number, commitSha: string, serverStat: ServerStat): Promise<void> {
    const strPrId = pr.toString()
    this.db.pulls[strPrId].siteCommit = commitSha
    const siteStat: SiteStat = (this.db.pulls[strPrId].siteCommit)
      ? ((this.db.pulls[strPrId].siteCommit === this.db.pulls[strPrId].headCommit) ? 'Online' : 'Not Latest')
      : 'Offline'
    const commentBody = genComment(
      `https://${this.owner.toLowerCase()}--${this.repo.toLowerCase()}--pr${pr}--preview.surge.sh`,
      siteStat,
      serverStat,
      this.db.pulls[strPrId].siteCommit
    )
    const bodyMd5 = md5(commentBody)
    if (bodyMd5 === this.db.pulls[strPrId].commentBody) return
    await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner: this.owner,
      repo: this.repo,
      comment_id: this.db.pulls[strPrId].commentId,
      body: commentBody
    })
    this.db.pulls[strPrId].commentBody = bodyMd5
    this.syncDb()
  }

  async onPrOpened (pr: number, headCommit: string): Promise<void> {
    const strPrId = pr.toString()
    console.log(`on pr opened pr:${pr}`)
    if (!this.db.pulls[strPrId]?.commentId) {
      this.db.pulls[strPrId] = {
        commentId: (await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner: this.owner,
          repo: this.repo,
          issue_number: pr,
          body: 'Hello!'
        })).data.id,
        commentBody: 'Hello!',
        siteCommit: '',
        headCommit: headCommit
      }
    }
    this.syncDb()
  }

  async onPrSynced (pr: number, headCommit: string): Promise<void> {
    this.db.pulls[pr.toString()].headCommit = headCommit
    this.syncDb()
    this.updComment(pr, this.db.pulls[pr.toString()].siteCommit, 'Ready')
  }

  async onPrClosed (pr: number): Promise<void> {
    console.log(`on pr closed pr:${pr}`)
    const siteUrl = `https://${this.owner.toLowerCase()}--${this.repo.toLowerCase()}--pr${pr}--preview.surge.sh`
    console.log(ChildProcess.execSync(`surge teardown ${siteUrl} --token ${this.surgeToken}`).toString())
    fs.rmSync(path.resolve(this.workDir, pr.toString()), { recursive: true })
    this.updComment(pr, '', 'Closed')
  }

  async onActionStarted (runId: number, pr: number, headCommit: string): Promise<void> {
    const strPrId = pr.toString()
    console.log(`on action started runId:${runId} pr:${pr}`)
    if (!this.db.pulls[strPrId]?.commentId) await this.onPrOpened(pr, headCommit)
    this.updComment(pr, this.db.pulls[strPrId].siteCommit, 'Preparing')
  }

  async onActionCompleted (runId: number, pr: number, headSha: string): Promise<void> {
    const strPrId = pr.toString()
    console.log(`on action completed runId:${runId} pr:${pr}`)
    const artifactList = (await this.octokit.request('/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
      owner: this.owner,
      repo: this.repo,
      run_id: runId
    })).data.artifacts
    // eslint-disable-next-line no-var
    var artifactId = -1
    for (const artifact of artifactList) {
      if (artifact.name === this.artifactName) {
        artifactId = artifact.id
        break
      }
    }
    if (artifactId === -1) return
    const tmp = (await this.octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}', {
      owner: this.owner,
      repo: this.repo,
      artifact_id: artifactId,
      archive_format: 'zip'
    }))
    // console.log(tmp)
    const artifactFile = new DataView(tmp.data as ArrayBuffer)
    const zipPath = path.resolve(this.workDir, `${strPrId}.zip`)
    const srcPath = path.resolve(this.workDir, strPrId)
    fs.writeFileSync(zipPath, artifactFile)
    console.log('artifact downloaded')
    if (fs.existsSync(srcPath)) fs.rmSync(srcPath, { recursive: true })
    await extract(zipPath, { dir: srcPath })
    fs.rmSync(zipPath)
    console.log('artifact loaded')
    const siteUrl = `https://${this.owner.toLowerCase()}--${this.repo.toLowerCase()}--pr${pr}--preview.surge.sh`
    console.log(ChildProcess.execSync(`surge ${srcPath} ${siteUrl} --token ${this.surgeToken}`).toString())
    this.updComment(pr, headSha, 'Ready')
  }

  async onCommented () {}
}
