function createPagingPipeline(page = 0, pageSize = Infinity) {
    return pageSize === Infinity
        ? []
        : [ { $skip: page * pageSize },
            { $limit: pageSize }
          ]
}

module.exports = async function setPagingHeaders(ctx, coll, pipeline) {
    const { page, pageSize } = ctx.request.query

    const { total } = await coll.aggregate([
        ...pipeline,
        { $count: 'total' }
    ])

    ctx.status = 200
    ctx.set('X-Total', total)
    ctx.set('X-Pages', Math.ceil(total / pageSize))
    ctx.set('X-Offset', pageSize * page)
    ctx.body = await coll.aggregate([
        ...pipeline,
        ...createPagingPipeline(page, pageSize)
    ]).toArray()
}