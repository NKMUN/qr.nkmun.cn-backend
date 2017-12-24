module.exports = function pluck(obj, ...fields) {
    let ret = {}
    fields.forEach(field => {
        if (obj[field] !== undefined)
            ret[field] = obj[field]
    })
    return ret
}