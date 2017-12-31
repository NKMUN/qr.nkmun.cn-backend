module.exports = async function APIAccessFilter(ctx, next) {
    const {
        headers: {
            'x-api-identity': apiIdentity,
            'x-api-key': apiKey
        },
        API_IDENTITY,
        API_KEY
    } = ctx

    // auth is disabled
    if (!API_IDENTITY || !API_KEY) {
        return await next()
    }

    if (apiIdentity === API_IDENTITY && apiKey === API_KEY) {
        return await next()
    } else {
        ctx.status = 403
        ctx.body = { error: 'BAD_API_AUTH', message: 'invalid api authorization' }
    }
}
