import fs from 'fs'
import path from 'path'
import { Octokit } from '@octokit/core'
import extract from 'extract-zip'

export default class {
  workDir: string
  owner: string
  repo: string
  artifactName: string
  octokit: Octokit
  db: {
    pulls: {
      [pr: string]: {
        comment: number
      }
    }
  }

  constructor (workDir:string, owner: string, repo: string, artifact: string, octokit: Octokit) {
    this.workDir = workDir
    this.owner = owner
    this.repo = repo
    this.artifactName = artifact
    this.octokit = octokit
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true })
    if (!fs.existsSync(path.resolve(this.workDir, 'db.json'))) fs.writeFileSync(path.resolve(this.workDir, 'db.json'), JSON.stringify({ pulls: {} }))
    this.db = JSON.parse(fs.readFileSync(path.resolve(this.workDir, 'db.json')).toString())
  }

}
