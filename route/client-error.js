const Router = require('koa-router')
const route = new Router()
const { OrgAccessFilter } = require('./auth')
const { newId, trimId } = require('../lib/id-util')
const pluck = require('../lib/pluck')
const paging = require('./paging')

route.post('/client-errors/',
    async ctx => {
        await ctx.db.collection('client_error').insertOne(ctx.request.body)
        ctx.status = 204
    }
)