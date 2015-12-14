module.exports = IdentityProvider

var webid = require('webid')
var rdf = require('rdf-ext')
var uuid = require('uuid')
var nn = rdf.createNamedNode
var lit = rdf.createLiteral

function defaultBuildURI (account, host, port) {
  var hostAndPort = host
  if (port) {
    hostAndPort = hostAndPort + port
  }
  if (!hostAndPort) hostAndPort = 'localhost'
  return 'https://' + account.toLowerCase() + '.' + hostAndPort + '/'
}

function IdentityProvider (options) {
  if (!(this instanceof IdentityProvider)) {
    return new IdentityProvider(options)
  }

  var self = this

  options = options || {}
  self.store = options.store
  self.pathCard = options.pathCard || 'profile/card'
  self.suffixURI = options.suffixURI || '#me'
  self.buildURI = options.buildURI || defaultBuildURI
}

// IdentityProvider.prototype.provide = function (options, callback) {
//   self.create(options, function (err) {
//     if (err) {
//       return callback(err)
//     }
//   })
// }

IdentityProvider.prototype.create = function (options, callback) {
  if (!options || !options.account) {
    var err = new Error('You must enter an account name!')
    err.statusCode = 406 // TODO
    return callback(err)
  }

  var self = this
  options.url = options.url || self.buildURI(options.account, self.host)
  options.card = options.url + self.pathCard
  options.agent = options.card + self.suffixURI

  // TODO maybe use promises
  self.setupCard(options, function (err) {
    if (err) {
      return callback(err)
    }

    self.setupSpace(options, function () {
      if (err) {
        callback(err)
      }

      callback(null, options.agent)
    })
  })
}

IdentityProvider.prototype.setupSpace = function (options, callback) {
  var self = this

  self.createRootAcl(options, function (err) {
    if (err) {
      err.statusCode = 500
      return callback(err)
    }

    callback()
  })
}

IdentityProvider.prototype.createRootAcl = function (options, callback) {
  var email = options.email
  var url = options.url
  var acl = options.url + options.suffixAcl
  var owner = acl + '#owner'
  var graph = rdf.createGraph()
  var agent = options.agent

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
    nn(url)))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#agent'),
    nn(agent)))

  if (email.length > 0) {
    graph.add(rdf.createTriple(
      nn(owner),
      nn('http://www.w3.org/ns/auth/acl#agent'),
      nn('mailto:' + email)))
  }

  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#defaultForNew'),
    nn(url)))
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

  return this.store(acl, graph, callback)
}

IdentityProvider.prototype.setupCard = function (options, callback) {
  var self = this

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

  // TODO implement generate in webid
  var graph = webid.generate({
    // TODO list all the attributes
    // if any
  })

  var card = options.card
  return self.store.add(card, graph, callback)
}

IdentityProvider.prototype.createCardAcl = function (options, callback) {
  var graph = rdf.createGraph()
  var url = options.card
  var acl = url + options.suffixAcl
  var agent = options.agent
  var owner = acl + '#owner'
  var readAll = acl + '#readall'

  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    nn('http://www.w3.org/ns/auth/acl#Authorization')))
  graph.add(rdf.createTriple(
    nn(owner),
    nn('http://www.w3.org/ns/auth/acl#accessTo'),
    nn(url)))

  // This is soon to be deprecated
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
  self.create(req.body, function (err, agent) {
    if (err) {
      return next(err)
    }

    res.session.agent = agent
    res.set('User', agent)

    if (req.body['spkac'] && req.body['spkac'].length > 0) {
      self.setupWebidTLS({
        spkac: req.body['spkac'],
        agent: agent
      }, next)
    } else {
      next()
    }
  })
}

IdentityProvider.prototype.setupWebidTLS = function (options, callback) {
  var self = this
  webid('tls').generate(options, function (err, cert) {
    if (err) {
      err.statusCode = 500
      return callback(err)
    }
    var id = uuid.v4()
    var card = options.agent.split('#')[0]
    var agent = options.agent
    var key = card + '#key' + id

    var graph = rdf.createGraph()
    graph.add(rdf.createTriple(
      nn(agent),
      nn('http://www.w3.org/ns/auth/cert#key'),
      nn(key)))
    graph.add(rdf.createTriple(
      nn(key),
      nn('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      nn('http://www.w3.org/ns/auth/cert#RSAPublicKey')))
    graph.add(rdf.createTriple(
      nn(key),
      nn('http://www.w3.org/2000/01/rdf-schema#label'),
      lit('Created on ' + (new Date()).toString())))
    graph.add(rdf.createTriple(
      nn(key),
      nn('http://www.w3.org/ns/auth/cert#modulus'),
      lit(cert.mod))) // add Datatype "http://www.w3.org/2001/XMLSchema#hexBinary"
    graph.add(rdf.createTriple(
      nn(key),
      nn('http://www.w3.org/ns/auth/cert#exponent'),
      lit(cert.exponent))) // TODO add Datatype "http://www.w3.org/2001/XMLSchema#int"

    self.store.merge(card, graph, callback)
  })
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
