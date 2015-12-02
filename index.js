module.exports = IdentityProvider

var webid = require('webid')
var rdf = require('rdf-ext')

function defaultBuildURI (username, host) {
  if (!host) host = 'localhost'
  return 'https://' + username + '.' + host
}

function IdentityProvider (options) {
  if (!(this instanceof IdentityProvider)) {
    return new IdentityProvider(options)
  }

  var self = this

  options = options || {}
  self.store = options.store
  self.card = options.card || 'profile/card'
  self.suffixURI = options.suffixURI || '#me'
  self.buildURI = options.buildURI || defaultBuildURI
}

IdentityProvider.prototype.create = function (options, callback) {
  if (!options || !options.account) {
    var err = new Error('You must enter an account name!')
    err.statusCode = 406 // TODO
    return callback(err)
  }

  var self = this

  // First create webId and then acl file
  // TODO pass the right options
  self.createCard(options, function (err) {
    if (err) {
      err.statusCode = 500 // TODO this should send 406 if taken
      return callback(err)
    }
    // TODO pass the right options
    self.createCardAcl(options, function (err) {
      if (err) {
        err.statusCode = 500 // TODO
        return callback(err)
      }

      // TODO create all the needed folders?

      return callback(err)
    })
  })

}

IdentityProvider.prototype.createCard = function (options, callback) {
  var self = this
  var account = options.account

  // TODO implement generate in webid
  var graph = webid.generate({
    // TODO list all the attributes
    // if any
  })

  var card = self.buildURI(account, self.host) + '/' + self.card
  return self.store.add(card, graph, callback)
}

IdentityProvider.prototype.createCardAcl = function (options, callback) {
  var graph = rdf.createGraph()
  var url = options.url
  var acl = options.acl
  var agent = options.url + this.suffixURI
  var owner = options.acl + '#owner'
  var readAll = options.acl + '#readall'
  var nn = rdf.createNamedNode

  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    nn('http://www.w3.org/ns/auth/acl#Authorization')))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#accessTo'),
    nn(url)))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#accessTo'),
    nn(acl)))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#agent'),
    nn(agent)))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#mode'),
    nn('http://www.w3.org/ns/auth/acl#Read')))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#mode'),
    nn('http://www.w3.org/ns/auth/acl#Write')))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#mode'),
    nn('http://www.w3.org/ns/auth/acl#Control')))

  graph.add(rdf.createTriple(
    nn(readAll),
    nn('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    nn('http://www.w3.org/ns/auth/acl#Authorization')))
  graph.add(rdf.createTriple(
    nn(readAll),
    nn('http://www.w3.org/ns/auth/acl#accessTo'),
    nn(url)))
  graph.add(rdf.createTriple(
    nn(readAll),
    nn('http://www.w3.org/ns/auth/acl#agentClass'),
    nn('http://xmlns.com/foaf/0.1/Agent')))
  graph.add(rdf.createTriple(
    nn(readAll),
    nn('http://www.w3.org/ns/auth/acl#mode'),
    nn('http://www.w3.org/ns/auth/acl#Read')))

  return this.store(acl, graph, callback)
}

// TODO create workspaces
// TODO create master acl

IdentityProvider.prototype.post = function (req, res, next) {
  var self = this
  self.create(req.body, next)
}

IdentityProvider.prototype.middleware = function (req, res, next) {
  var self = this

  if (req.method === 'POST') {
    self.post(req, res, next)
  } else {
    var err = new Error('Can only do GET or POST')
    err.statusCode = 406
    next(err)
  }
}
