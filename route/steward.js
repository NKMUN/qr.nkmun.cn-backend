const Router = require('koa-router')
const route = new Router()

const { sign } = require('jsonwebtoken')

const AUTHORIZATION_PREFIX = 'Bearer '

const { OrgAccessFilter } = require('./auth')

route.post('/orgs/:org/stewards/',
    OrgAccessFilter('constable'),
    async ctx => {
        const {
            identifier,
            expires = Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60
        } = ctx.request.body
        const { org } = ctx.params
        const { DOMAIN } = ctx

        const token = sign({
            identifier,
            org,
            access: [`${org}.steward`],
            exp: expires
        }, ctx.JWT_SECRET)

        ctx.status = 200
        ctx.body = {
            url: `https://${DOMAIN}/?preauth=${token}`
        }
    }
)

route.get('/orgs/:org/stewards/~',
    OrgAccessFilter('steward'),
    async ctx => {
        ctx.status = 200
        ctx.body = {}
    }
)

module.exports = {
    routes: route.routes()
}