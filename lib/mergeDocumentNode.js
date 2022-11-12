'use strict'

module.exports = function (nodes) {
  const schema = {
    kind: 'Document',
    definitions: [],
    loc: {
      source: {
        body: ''
      }
    }
  }

  nodes.forEach(s => {
    schema.definitions = [...schema.definitions, ...s.definitions]
    schema.loc.source.body = `${schema.loc.source.body}${s.loc.source.body}`
  })

  return schema
}
