const Router = require('koa-router')
const route = new Router()
const { OrgAccessFilter } = require('./auth')
const { newId, trimId } = require('../lib/id-util')
const pluck = require('../lib/pluck')
const paging = require('./paging')
const APIAccessFilter = require('./api-auth')

const PROJECT_OBJECT = org => ({
    _id: false,
    id: { $substr: ['$_id', org.length + 1, -1] },
    name: '$name',
    org: '$org',
    role: '$role',
    redirect: '$redirect',
    extra: '$extra'
})

route.get('/orgs/:org/objects/:object',
    OrgAccessFilter('constable.object.get'),
    async ctx => {
        ctx.status = 501
        ctx.body = { error: 'NOT_IMPLEMENTED', message: 'not implemented' }
    }
)

route.get('/orgs/:org/objects/',
    OrgAccessFilter('constable.object.get'),
    async ctx => {
        const {
            role,
            orderBy,
            page,
            pageSize
        } = ctx.request.body

        const pipeline = [
            { $match: { org } },
            { $match: role ? { role: {$in: [role]} } : {} },
            { $project: PROJECT_OBJECT(ctx.params.org) },
            // TODO: sort
            ...paging(page, pageSize)
        ]

        ctx.status = 200
        ctx.body = await ctx.db.collection('object').aggregate(pipeline).toArray()
    }
)

route.post('/orgs/:org/objects/',
    APIAccessFilter,
    async ctx => {
        const {
            name,
            role,
            redirect,
            extra
        } = ctx.request.body
        const {org} = ctx.params

        const _id = `${org}.${newId()}`
        await ctx.db.collection('object').insertOne({
            _id,
            name,
            org,
            role: Array.isArray(role) ? role : [role],
            redirect,
            extra
        })

        ctx.status = 200
        ctx.body = trimId(await ctx.db.collection('object').findOne({ _id }))
    }
)

route.patch('/orgs/:org/objects/:object',
    APIAccessFilter,
    async ctx => {
        const {org, object} = ctx.params
        const _id = `${org}.${object}`

        const payload = pluck(ctx.request.body, 'role', 'redirect', 'name', 'extra')
        if (payload.role && !Array.isArray(payload.role)) {
            payload.role = [payload.role]
        }

        const {
            result: { ok }
        } = await ctx.db.collection('object').updateOne(
            { _id },
            { $set: payload }
        )

        if (!ok) {
            ctx.status = 404
            ctx.body = { error: 'OBJECT_NOT_FOUND', message: 'object not found' }
            return
        }

        ctx.status = 200
        ctx.body = trimId( await ctx.db.collection('object').findOne({ _id }, { records: false }) )
    }
)

module.exports = {
    routes: route.routes()
}