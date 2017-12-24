const Router = require('koa-router')
const route = new Router()

const { sign } = require('jsonwebtoken')

const AUTHORIZATION_PREFIX = 'Bearer '
const Password = require('../lib/password')
const JWT_OPTS = { expiresIn: '14d' }

const { AccessFilter } = require('./auth')

route.post('/login',
    async (ctx) => {
        const { db, JWT_SECRET } = ctx
        const { user, password } = ctx.request.body

        let storedCred = await db.collection('user').findOne({ _id: user })
        const { org } = storedCred

        if ( !storedCred || !Password.verify(password, storedCred) ) {
            ctx.status = 401
            ctx.body = { message: 'Invalid credential' }
            ctx.set('WWW-Authenticate', AUTHORIZATION_PREFIX+'token_type="JWT"')
            return
        }

        let cred = {
            user: storedCred._id,
            org: storedCred.org,
            access: (storedCred.access || []).map(
                access => access === 'admin' ? org : `${org}.${access}`
            )
        }

        ctx.status = 200
        ctx.body = {
            user,
            token: sign(cred, JWT_SECRET, JWT_OPTS)
        }
    }
)

module.exports = {
    routes: route.routes()
}
