module.exports = async function APIAccessFilter(ctx, next) {
    const {
        headers: {
            'x-api-key': apiKey,
            'x-api-secret': apiSecret
        },
        API_KEY,
        API_SECRET
    } = ctx

    // auth is disabled
    if (!API_KEY || !API_SECRET) {
        return await next()
    }

    if (apiKey === API_KEY && apiSecret === API_SECRET) {
        return await next()
    } else {
        ctx.status = 403
        ctx.body = { error: 'BAD_API_AUTH', message: 'invalid api authorization' }
    }
}
