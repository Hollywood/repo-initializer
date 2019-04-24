const maxActionsPerRun = 30

module.exports = class repoInitialize {
    constructor(github, {
        owner,
        repo,
        logger = console,
        ...config
    }) {
        this.github = github
        this.logger = logger
        this.remainingActions = 0

        this.config = config
        if (error) {
            // Report errors to sentry
            logger.warn({
                err: new Error(error),
                owner,
                repo
            }, 'Invalid config')
        }

        Object.assign(this.config, {
            owner,
            repo
        })
    }

    async markAndSweep(config) {

        this.logger.info(this.config, `starting mark and sweep of repos`)

        const limitPerRun = this.getConfigValue(type, 'limitPerRun') || maxActionsPerRun
        this.remainingActions = Math.min(limitPerRun, maxActionsPerRun)

        await this.mark(config)
    }

    async mark(config) {
        const {
            owner,
            repo
        } = this.config

        await this.ensureInitLabelExists()

        const repoList = (await this.getRepos()).data.items

        repoList.forEach(function (repo) {

            const teamList = this.github.repos.getTeams({
                owner: owner,
                repo: repo
            })
            const hasDefaultTeam = teamList.find(t => t.slug === config.defaultTeam)

            if (!hasDefaultTeam) {
                return this.markIssue()
            }

            await Promise.all(repoList.filter(t => !issue.locked).map(issue => {
                return this.markIssue(type, issue)
            }))
        })
    }

    async sweep() {
        const {
            owner,
            repo
        } = this.config
        const daysUntilClose = this.getConfigValue(type, 'daysUntilClose')

        if (daysUntilClose) {
            this.logger.trace({
                owner,
                repo
            }, 'Configured to close issues')
            const closableItems = (await this.getClosable(type)).data.items

            await Promise.all(closableItems.filter(issue => !issue.locked).map(issue => {
                this.close(type, issue)
            }))
        } else {
            this.logger.trace({
                owner,
                repo
            }, 'Configured to leave issues open')
        }
    }

    async getRepos() {
        const days = this.getConfigValue(type, 'days') || this.getConfigValue(type, 'daysUntilMarked')
        return this.search(type, days, query)
    }


    search(days, query) {
        const {
            owner,
            repo
        } = this.config
        const timestamp = this.since(days).toISOString().replace(/\.\d{3}\w$/, '')

        query = `org:${owner} created:<${timestamp} ${query}`

        const params = {
            q: query,
            sort: 'updated',
            order: 'desc',
            per_page: maxActionsPerRun
        }

        this.logger.info(params, 'searching %s/%s for repos without the assigned default team and topics.', owner, repo)
        return this.github.search.issues(params)
    }

    async markIssue(type, issue) {
        if (this.remainingActions === 0) {
            return
        }
        this.remainingActions--

        const {
            owner,
            repo
        } = this.config
        const initLabel = this.getConfigValue(type, 'initLabel')
        const markComment = this.getConfigValue(type, 'markComment')
        const number = issue.number

        this.logger.info('%s/%s#%d is being marked', owner, repo, number)
        if (markComment) {
            await this.github.issues.createComment({
                owner,
                repo,
                number,
                body: markComment
            })
        }
        return this.github.issues.addLabels({
            owner,
            repo,
            number,
            labels: [initLabel]
        })

    }

    async unmarkIssue(type, issue) {
        const {
            owner,
            repo
        } = this.config
        const initLabel = this.getConfigValue(type, 'initLabel')
        const unmarkComment = this.getConfigValue(type, 'unmarkComment')
        const number = issue.number

        this.logger.info('%s/%s#%d is being unmarked', owner, repo, number)

        if (unmarkComment) {
            await this.github.issues.createComment({
                owner,
                repo,
                number,
                body: unmarkComment
            })
        }

        return this.github.issues.removeLabel({
            owner,
            repo,
            number,
            name: initLabel
        }).catch((err) => {
            // ignore if it's a 404 because then the label was already removed
            if (err.code !== 404) {
                throw err
            }
        })
    }


    hasInitLabel(type, issue) {
        const initLabel = this.getConfigValue(type, 'initLabel')
        return issue.labels.map(label => label.name).includes(initLabel)
    }

    // returns a type-specific config value if it exists, otherwise returns the top-level value.
    getConfigValue(type, key) {
        if (this.config[type] && typeof this.config[type][key] !== 'undefined') {
            return this.config[type][key]
        }
        return this.config[key]
    }

    async ensureInitLabelExists() {
        const {
            owner,
            repo
        } = this.config
        const initLabel = this.getConfigValue('label', 'initLabel')

        return this.github.issues.getLabel({
            owner,
            repo,
            name: initLabel
        }).catch(() => {
            return this.github.issues.createLabel({
                owner,
                repo,
                name: initLabel,
                color: 'ffffff'
            })
        })
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