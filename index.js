const createScheduler = require('probot-scheduler')
const yaml = require('js-yaml')
const defaults = require('./defaults.js')
const repoInitialize = require('./lib/repoInitialize.js')

module.exports = async app => {
  createScheduler(app)

  app.on('schedule.repository', markAndSweep)
  app.on('repository.created', markAndSweep)

  async function markAndSweep(context) {
    //Loading config on each run to ensure up to date data
    const res = await context.github.repos.getContents({
      owner: context.payload.repository.owner.login,
      repo: defaults.repo,
      path: defaults.path
    })
    const owner = context.payload.repository.owner.login

    const content = Buffer.from(res.data.content, 'base64').toString('utf8')
    const config = yaml.safeLoad(content)
    const init = await forRepository(context, owner, config)
    await init.markAndSweep(config)
  }


  async function forRepository(context, owner) {
    return new repoInitialize(context.github, owner)
  }
}