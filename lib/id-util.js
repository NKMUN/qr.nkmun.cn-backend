const shortid = require('shortid')

module.exports = {
    toId(entry) {
        entry.id = entry._id
        delete entry._id
        return entry
    },
    fromId(entry) {
        entry._id = entry.id
        delete entry.id
        return entry
    },
    newId() {
        return shortid.generate()
    },
    trimId(obj, org = null) {
        let ret = {...obj}
        if (org === null) {
            // herustic guess
            const originalId = obj._id || obj.id
            const pos = originalId.indexOf('.')
            if (pos !== -1) {
                ret.id = originalId.slice(pos + 1)
            } else {
                ret.id = originalId
            }
        } else {
            ret.id = (obj._id || obj.id).slice(org.length + 1)
        }
        delete ret._id
        return ret
    }
}
