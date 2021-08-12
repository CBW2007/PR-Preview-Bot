import main from './main'

main('./cache',
  9999,
  [{ owner: 'CBW2007', repo: 'test', actionName: 'build', artifactName: 'public' }],
  'ghToken',
  'webSecret',
  'surgeToken'
)
