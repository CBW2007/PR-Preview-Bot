import main from './main'
import fs from 'fs'

const config = JSON.parse(fs.readFileSync('./config.json').toString())

main(config.workDir, config.port, config.projects, config.ghToken, config.webSecret, config.surgeToken)
