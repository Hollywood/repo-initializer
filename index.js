const createScheduler = require('probot-scheduler')

module.exports = async app => {
  createScheduler(app)
  const res = await context.github.repos.getContents({
    owner: context.payload.organization.login,
    repo: 'org-settings',
    path: '.github/repo-initializer.yml'
  })

  const content = Buffer.from(res.data.content, 'base64').toString('utf8')

  const yaml = require('js-yaml')
  const config = yaml.safeLoad(content)

  // Capture when a team is added to a repo
  const events = [
    'added_to_repository'
  ]

  app.on(events, unmark)
  app.on('schedule.repository', markAndSweep)


  async function unmark(context) {
    if (!context.isBot) {
      const init = await forRepository(context)

      const teamList = await context.github.repos.listTeams({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name
      })
      const hasDefaultTeam = teamList.find(t => t.team.slug === config.defaultTeam)

      if (hasDefaultTeam) {
        init.removeIssue()
      }
    }
  }

  async function markAndSweep(context) {
    const init = await forRepository(context)
    await init.markAndSweep(config)
  }


  async function forRepository(context) {
    return new repoInitialize(context.github, config)
  }
}