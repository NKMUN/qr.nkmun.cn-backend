const Router = require('koa-router')
const route = new Router()
const { OrgAccessFilter } = require('./auth')
const { newId, trimId } = require('../lib/id-util')
const pluck = require('../lib/pluck')
const paging = require('./paging')

async function Event(ctx, next) {
    const {org, event: eventId} = ctx.params
    const event = await ctx.db.collection('event').findOne({ _id: `${org}.${eventId}`})
    if (event) {
        ctx.event = event
        await next()
    } else {
        ctx.status = 404
        ctx.body = { error: 'EVENT_NOT_FOUND', message: 'no such event' }
    }
}

route.post('/orgs/:org/events/',
    OrgAccessFilter('constable.event.create'),
    async ctx => {
        const {org} = ctx.params
        const {
            name,
            start_at,
            tardy_at,
            end_at,
        } = ctx.request.body
        const _id = `${org}.${newId()}`

        await ctx.db.collection('event').insertOne({
            _id,
            name,
            org,
            start_at,
            tardy_at,
            end_at,
            created_at: new Date()
        })

        ctx.status = 200
        ctx.body = trimId(await ctx.db.collection('event').findOne({ _id }))
    }
)

route.get('/orgs/:org/events/',
    OrgAccessFilter('constable.event.get', 'steward'),
    async ctx => {
        const { org } = ctx.params
        ctx.status = 200
        ctx.body = await ctx.db.collection('event').aggregate([
            { $match: { org } },
            { $project: {
                _id: false,
                id: { $substr: ['$_id', org.length + 1, -1] },
                name: '$name',
                org: '$org',
                start_at: '$start_at',
                tardy_at: '$tardy_at',
                end_at: '$end_at'
            }}
        ]).toArray()
    }
)

route.patch('/orgs/:org/events/:event',
    OrgAccessFilter('constable.event.modify'),
    Event,
    async ctx => {
        const {org} = ctx.params
        const payload = pluck(ctx.request.body, 'name', 'start_at', 'tardy_at', 'end_at')
        const _id = ctx.event._id

        await ctx.db.collection('event').updateOne(
            { _id },
            { $set: {
                ...payload,
                modified_at: new Date()
            } }
        )

        ctx.status = 200
        ctx.body = trimId( await ctx.db.collection('event').findOne({ _id }) )
    }
)

route.delete('/orgs/:org/events/:event',
    OrgAccessFilter('constable.event.delete'),
    Event,
    async ctx => {
        const {org} = ctx.params
        const payload = pluck(ctx.request.body, 'name', 'start_at', 'tardy_at', 'end_at')
        const _id = ctx.event._id

        await ctx.db.collection('event').deleteOne({ _id })
        // TODO: delete participant's attendance record
    }
)

route.get('/orgs/:org/events/:event',
    OrgAccessFilter('constable.event.get'),
    Event,
    async ctx => {
        ctx.status = 200
        ctx.body = trimId(ctx.event, ctx.params.org)
    }
)

const buildResultMatch = (event, requestedResult) => {
    switch (requestedResult) {
        case 'attended': return {
            $or: [
                { [`records.${event}.conclusion`]: 'attended' },
                { [`records.${event}.conclusion`]: 'late' }
            ]
        }
        case 'late': return {
            [`records.${event}.conclusion`]: 'late'
        }
        case 'absent': return {
            $or: [
                { [`records.${event}.conclusion`]: { $exists: false } },
                { [`records.${event}.conclusion`]: 'absent' }
            ]
        }
        case 'missing': return {
            [`records.${event}.reported_by`]: { $exists: false }
        }
        default: return {}
    }
}

route.get('/orgs/:org/events/:event/records',
    OrgAccessFilter('constable.event.get'),
    Event,
    async ctx => {
        const {org, event} = ctx.params
        const {
            role,
            result,
            orderBy = 'time'
        } = ctx.request.query

        let pipeline = [
            { $match: { org } },
            { $match: role && role !== '*' ? { role: {$in: [role] } } : {} },
            { $match: buildResultMatch(event, result) },
            { $sort: { [`records.${event}.report_at`]: -1, '_id': -1 } },
            { $project: {
              _id: false,
              id: { $substr: ['$_id', org.length + 1, -1] },
              name: '$name',
              role: '$role',
              extra: '$extra',
              reported_by: `$records.${event}.reported_by`,
              reported_at: `$records.${event}.reported_at`,
              reported_extra: `$records.${event}.extra`,
              conclusion: `$records.${event}.conclusion`,
            } }
        ]

        await paging(
            ctx,
            ctx.db.collection('object'),
            pipeline
        )
    }
)

route.post('/orgs/:org/events/:event/records/',
    OrgAccessFilter('steward'),
    Event,
    async ctx => {
        const {org} = ctx.params
        const {steward, auth, extra, identifier} = ctx.request.body

        // grace period, check for event ends/starts
        const {start_at, tardy_at, end_at} = ctx.event
        const GRACE_PERIOD = 60 * 1000 * 3
        if (start_at - GRACE_PERIOD > Date.now()) {
            ctx.status = 417
            ctx.body = { error: 'EVENT_NOT_STARTED', message: 'event not started' }
            return
        }
        if (end_at + GRACE_PERIOD < Date.now()) {
            ctx.status = 417
            ctx.body = { error: 'EVENT_HAS_ENDED', message: 'event has ended' }
            return
        }

        const eventKey = `records.${ctx.params.event}`
        const _id = `${org}.${identifier}`
        const object = await ctx.db.collection('object').findOne(
            { _id }, { [eventKey]: true }
        )

        if (!object) {
            ctx.status = 404
            ctx.body = { error: 'OBJECT_NOT_FOUND', message: 'object not found in org' }
            return
        }

        if (object.records && Object.keys(object.records).length) {
            // already checked in
            ctx.status = 208
        } else {
            // not checked in
            ctx.status = 200
            await ctx.db.collection('object').updateOne(
                { _id },
                { $set: {
                    [eventKey]: {
                        conclusion: Date.now() < tardy_at + GRACE_PERIOD
                                    ? 'attended'
                                    : Date.now() < end_at + GRACE_PERIOD
                                        ? 'late'
                                        : 'absent',
                        reported_at: new Date(),
                        reported_by: steward,
                        extra: extra,
                    }
                } }
            )
        }

        const ret = await ctx.db.collection('object').findOne(
            { _id },
            { [eventKey]: true, name: true, role: true, extra: true }
        )
        // masq nested key to flat key
        ret.record = ret.records[ctx.params.event]
        delete ret.records
        ctx.body = trimId(ret)
    }
)

module.exports = {
    Event,
    routes: route.routes()
}