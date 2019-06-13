const createScheduler = require('probot-scheduler')
const yaml = require('js-yaml')

module.exports = async app => {
  createScheduler(app)

  // Saving for future enhancement
  // const events = [
  //   'added_to_repository',
  // ]

  //app.on(events, unmark)

  app.on('schedule.repository', markAndSweep)

  // Keeping for future use
  // async function unmark(context) {
  //   if (!context.isBot) {
  //     const init = await forRepository(context)

  //     const teamList = await context.github.repos.listTeams({
  //       owner: context.payload.repository.owner.login,
  //       repo: context.payload.repository.name
  //     })
  //     const hasDefaultTeam = teamList.find(t => t.team.slug === config.defaultTeam)

  //     if (hasDefaultTeam) {
  //       init.removeIssue()
  //     }
  //   }
  // }

  async function markAndSweep(context) {
    //Loading config on each run to ensure up to date data
    const res = await context.github.repos.getContents({
      owner: context.payload.organization.login,
      repo: 'org-settings',
      path: '.github/repo-initializer.yml'
    })
  
    const content = Buffer.from(res.data.content, 'base64').toString('utf8')
    const config = yaml.safeLoad(content)
    const init = await forRepository(context)
    await init.markAndSweep(config)
  }


  async function forRepository(context) {
    return new repoInitialize(context.github, config)
  }
}