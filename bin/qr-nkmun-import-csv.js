#!/usr/bin/env node

const program = require('commander')

program
  .version('0.1.0')
  .option('-o, --org <org>', 'Organization, default: nkmun', String)
  .option('-s, --server <server>', 'QR Server Endpoint, default: http://localhost:8005')
  .option('-i, --api-identity <identity>', 'API identity')
  .option('-k, --api-key <key>', 'API key')
  .option('-f, --csv <path>', 'CSV Path, use - for stdin')
  .parse(process.argv)

let {
  org = 'nkmun',
  server = "http://localhost:8005",
  force = false,
  apiIdentity = null,
  apiKey = null,
  csv: csvPath = '-'
} = program

const agent = require('superagent')
function API_createObject({name, role, extra}) {
  return agent.post(`${server}/orgs/${org}/objects/`)
      .set('x-api-identity', apiIdentity)
      .set('x-api-key', apiKey)
      .send({ name, role, extra })
}

const inputStream = csvPath === '-' ? process.stdin : require('fs').createReadStream(csvPath)
const rl = require('readline').createInterface({ input: inputStream })
let isFirst = true
rl.on('line', async (line) => {
  if (!isFirst) {
    const [name, role, committee, school] = line.split(',')
    const {
      body: { id: qrId }
    } = await API_createObject({ name, role, extra: { school, committee } })
    process.stdout.write(line + ',' + qrId + '\n')
  } else {
    process.stdout.write(line + ',id' + '\n')
  }
  isFirst = false
})
