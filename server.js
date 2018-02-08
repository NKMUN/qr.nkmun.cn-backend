const MongoSanitize = require('koa-mongo-sanitize')
const {createServer} = require('http')
const Koa = require('koa')
const KoaBody = require('koa-body')
const AccessLog = require('koa-accesslog')

module.exports = {
    async create({
        port = 8081,
        host = undefined,
        db = 'mongodb://localhost:27017/test',
        domain = 'localhost',
        secret = require('crypto').randomBytes(32).toString('base64'),
        apiKey = null,
        apiIdentity = null,
    }) {
        const app = new Koa()
        app.proxy = true

        app.context.JWT_SECRET = secret
        app.context.API_IDENTITY = apiIdentity
        app.context.API_KEY = apiKey
        app.context.DOMAIN = domain
        app.context.db = await require('mongodb').MongoClient.connect( db )

        app.on('error', (err) => {
            console.log(err.stack)
        })

        app.use( AccessLog() )
        app.use( KoaBody({multipart: true}) )
        app.use( MongoSanitize() )

        app.use( require('./route/user').routes )
        app.use( require('./route/steward').routes )
        app.use( require('./route/event').routes )
        app.use( require('./route/object').routes )
        app.use( require('./route/client-error').routes )

        let server = createServer( app.callback() )
                     .listen(port, host, () => {
                         let {address, port, family} = server.address()
                         if (family === 'IPv6')
                             address = `[${address}]`
                         console.log(`Server listening on: ${address}:${port}`)
                     })

        return server
    }
}