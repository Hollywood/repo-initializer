const maxActionsPerRun = 30

module.exports = class repoInitialize {
    /**
     * @param {import('probot/lib/github').GitHubAPI} github
     */
    constructor(github, owner, config) {
        this.github = github
        this.remainingActions = 0
        this.config = config
        this.owner = owner
        this.repo = ''
    }

    async markAndSweep(config) {

        //app.log.debug({config}, `starting mark and sweep of repos`)

        //const limitPerRun = this.getConfigValue('limitPerRun')
        //this.remainingActions = Math.min(limitPerRun, maxActionsPerRun)

        await this.mark(config)
    }

    async mark(config) {
        this.config = config

        const repoList = (await this.getRepos()).data.items

        await Promise.all(repoList.map(async repo => {
            this.repo = repo
            await this.ensureInitLabelExists()

            Object.assign(this.config, { owner, repo })

            const teamList = await this.github.repos.getTeams({
                owner: owner,
                repo: repo
            })

            const hasDefaultTeam = teamList.find(t => t.slug === config.defaultTeam)
            const hasTopics = await this.github.repos.listTopics({
                owner: owner,
                repo: repo
            })

            if (!hasTopics || !hasDefaultTeam) {
                return this.markIssue()
            }
        })).catch(error => {
            //app.log.debug({error}, `an exception occurred while processing repositories.`)
        })
    }


    async getRepos() {
        const days = this.getConfigValue('daysUntilMarked')
        return this.search(days)
    }


    search(days) {
        const owner = this.owner
        const timestamp = this.since(days).toISOString().replace(/\.\d{3}\w$/, '')

        const query = `org:${owner} created:<=${timestamp} is:repo`

        const params = {
            q: query,
            sort: 'updated',
            order: 'desc',
            per_page: maxActionsPerRun
        }

        //app.log.debug({owner}, `searching for repos without the assigned default team and topics`)

        return this.github.search.repos(params)
    }

    async markIssue() {
        const {
            owner,
            repo
        } = this.config

        const initLabel = 'missing-information' //this.getConfigValue('initLabel')

        //const markComment = this.getConfigValue('markComment')
        const markComment = 'This issue has been automatically created because this repository does not have the appropriate team and/or topics assigned to it. Please take appropriate actions. Thank you for your contributions.'

        //const markTitle = this.getConfigValue('markTitle')
        const markTitle = 'Repository Missing Required Information'

        return this.github.issues.create({
            owner,
            repo,
            body: markComment,
            title: markTitle,
            labels: [initLabel] 
        })
    }

    // returns a type-specific config value if it exists, otherwise returns the top-level value.
    getConfigValue(key) {
        return this.config[key]
    }

    async ensureInitLabelExists() {
        //const initLabel = this.getConfigValue('initLabel')
        const initLabel = 'missing-information'

        try {
            await this.github.issues.createLabel({
                owner: this.owner,
                repo: this.repo,
                name: initLabel,
                color: 'ffffff'
            })
        } catch {
            //swallowing 
        }


    }

    since(days) {
        const ttl = days * 24 * 60 * 60 * 1000
        let date = new Date(new Date() - ttl)

        // GitHub won't allow it
        if (date < new Date(0)) {
            date = new Date(0)
        }
        return date
    }

}