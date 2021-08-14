import fs from 'fs'
import path from 'path'
import ChildProcess from 'child_process'
import { Octokit } from '@octokit/core'
import extract from 'extract-zip'
import { generateComment } from './utils'

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
        commentBody: string
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

  async updComment (commentId: number, body: string, pr: number, commitSha: string) {
    await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      body
    })
    this.db.pulls[pr.toString()].commentBody = body
  }

  async onPrOpened (pr: number): Promise<void> {
    console.log(`on pr opened pr:${pr}`)
    if (!this.db.pulls[pr.toString()]?.commentId) {
      this.db.pulls[pr.toString()] = {
        commentId: (await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner: this.owner,
          repo: this.repo,
          issue_number: pr,
          body: 'Hello!'
        })).data.id,
        commentBody: 'Hello!'
      }
    }
    fs.writeFileSync(path.resolve(this.workDir, 'db.json'), JSON.stringify(this.db))
  }

  async onActionStarted (runId: number, pr: number, commitSha: string): Promise<void> {
    console.log(`on action started runId:${runId} pr:${pr}`)
    if (!this.db.pulls[pr.toString()]?.commentId) await this.onPrOpened(pr)
    const body = generateComment(`https://${this.owner}--${this.repo}--pr${pr}--preview.surge.sh`, 0, commitSha)
    if (body !== this.db.pulls[pr.toString()].commentBody) {
      await this.updComment(this.db.pulls[pr.toString()].commentId, body, pr, commitSha)
    }
  }

  async onActionCompleted (runId: number, pr: number, commitSha: string): Promise<void> {
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
    const artifactFile = new DataView((await this.octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}', {
      owner: this.owner,
      repo: this.repo,
      artifact_id: artifactId,
      archive_format: 'zip'
    })).data as ArrayBuffer)
    const zipPath = path.resolve(this.workDir, `${pr.toString()}.zip`)
    const srcPath = path.resolve(this.workDir, pr.toString())
    fs.writeFileSync(zipPath, artifactFile)
    if (fs.existsSync(srcPath)) fs.rmSync(srcPath, { recursive: true })
    await extract(zipPath, { dir: srcPath })
    fs.rmSync(zipPath)
    console.log('artifact loaded')
    console.log(ChildProcess.execSync(`surge ${srcPath} ${this.owner}--${this.repo}--pr${pr}--preview.surge.sh --token ${this.surgeToken}`).toString())
    const body = generateComment(`https://${this.owner}--${this.repo}--pr${pr}--preview.surge.sh`, 1, commitSha)
    if (body !== this.db.pulls[pr.toString()].commentBody && commitSha) {
      await this.updComment(this.db.pulls[pr.toString()].commentId, body, pr, commitSha)
    }
  }
}
