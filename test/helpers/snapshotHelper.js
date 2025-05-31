const fs = require('fs')
const path = require('path')
const assert = require('assert')

const SNAPSHOT_DIR = path.join(__dirname, '../snapshots-test')
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })

function matchSnapshot (value, options = {}) {
  const snapshotName = options.name || 'default'
  const snapshotPath = path.join(SNAPSHOT_DIR, `${snapshotName}.test.snap`)

  const formatted =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  // If "forceCreate" is true, it always creates a new file, otherwise it checks if it exists
  const forceCreate = options.forceCreate || false

  // Always create a new file if "forceCreate" is true, otherwise do the comparison if the file exists
  if (!fs.existsSync(snapshotPath) || forceCreate) {
    fs.writeFileSync(snapshotPath, formatted, 'utf-8')
    console.log(`[Snapshot created]: ${snapshotName}`)
  } else {
    const existingSnapshot = fs.readFileSync(snapshotPath, 'utf-8')

    if (formatted !== existingSnapshot) {
      const message = `[Snapshot mismatch]: ${snapshotName}\n\nExpected:\n${existingSnapshot}\n\nBut got:\n${formatted}`
      assert.strictEqual(formatted, existingSnapshot, message)
    } else {
      console.log(`[Snapshot valid]: ${snapshotName}`)
    }
  }
}

module.exports = { matchSnapshot }
