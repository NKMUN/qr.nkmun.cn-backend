function createPagingPipeline(page = 0, pageSize = Infinity) {
    return pageSize === Infinity
        ? []
        : [ { $skip: page * pageSize },
            { $limit: pageSize }
          ]
}

module.exports = async function setPagingHeaders(ctx, coll, pipeline) {
    const { page: _page, pageSize: _pageSize } = ctx.request.query

    const totalResult = await coll.aggregate([
        ...pipeline,
        { $count: 'total' }
    ]).toArray()

    const { total } = totalResult[0]

    const page = parseInt(_page) || 0
    const pageSize = parseInt(_pageSize) || 10

    ctx.status = 200
    ctx.set('X-Total', total)
    ctx.set('X-Pages', Math.ceil(total / pageSize))
    ctx.set('X-Offset', pageSize * page)
    ctx.body = await coll.aggregate([
        ...pipeline,
        ...createPagingPipeline(page, pageSize)
    ]).toArray()
}