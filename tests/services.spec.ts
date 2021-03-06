import auth, { errors as authErrors } from '../src/auth/index'
import { expect } from 'chai'
import 'mocha'
import { Config, Auth, ProtectedJangleCore, IJangleItem } from '../src/types'
import { Schema } from 'mongoose'
import * as mongoose from 'mongoose'
import models, { getConnections } from '../src/models/index'
import services, { errors } from '../src/services/index'
import { ObjectId } from 'bson'
import { debug } from '../src/utils';

const fail = () => expect(true).to.be.false

describe('core', () => {
  const config: Config = {
    mongo: {
      content: process.env.MONGO_TEST_URI || 'mongodb://localhost/jangle-test',
      live: process.env.MONGO_TEST_URI_LIVE || 'mongodb://localhost/jangle-test-live'
    },
    secret: 'some-secret',
    schemas: {
      Example: new Schema({
        name: {
          type: String,
          required: true
        },
        age: Number
      }),
      AnotherExample: new Schema({
        title: String
      })
    }
  }
  const numberOfUserModels = Object.keys(config.schemas).length

  const dropCollections = (uri) =>
    new Promise((resolve, reject) => {
      mongoose.connect(uri, function (err) {
        if (err) {
          reject(err)
        } else {
          mongoose.connection.db.dropDatabase()
          resolve()
        }
      })
    })

  const clearAllCollections = () =>
    Promise.all([
      dropCollections(config.mongo.content),
      dropCollections(config.mongo.live)
    ])
      .catch(console.error)

  const login = {
    email: 'test@jangle.com',
    password: 'password'
  }

  let Jangle : ProtectedJangleCore = undefined
  let Token = undefined

  before(() =>
    clearAllCollections()
      .then(_ => models.initialize({ config }))
      .then(auth.initialize)
      .then(services.initialize)
      .then(core => { Jangle = core })
  )

  it('exposes auth', () => {
    expect(Jangle.auth).to.exist
  })

  it('exposes services', () => {
    expect(Jangle.services).to.exist
  })

  describe('auth', () => {

    it('allows creation of first admin', () =>
      Jangle.auth
        .createInitialAdmin(login.email, login.password)
        .then(token => {
          Token = token
          expect(token).to.be.a('string')
        })
    )

    it('allows sign in', () =>
      Jangle.auth.signIn(login.email, login.password)
        .then(token => {
          expect(token).to.equal(Token)
        })
    )

  })

  describe('services', () => {

    it('has a service for each schema', () => {
      expect(Jangle.services.Example).to.exist
      expect(Jangle.services.AnotherExample).to.exist
    })
  
    it('has all read functions', () => {
      const Example = Jangle.services.Example
      expect(Example.any).to.be.a('function')
      expect(Example.count).to.be.a('function')
      expect(Example.find).to.be.a('function')
      expect(Example.get).to.be.a('function')
    })
  
    it('has all write functions', () => {
      const Example = Jangle.services.Example
      expect(Example.create).to.be.a('function')
      expect(Example.update).to.be.a('function')
      expect(Example.patch).to.be.a('function')
      expect(Example.remove).to.be.a('function')
    })
  
    it('has all publish functions', () => {
      const Example = Jangle.services.Example
      expect(Example.publish).to.be.a('function')
      expect(Example.unpublish).to.be.a('function')
      expect(Example.isLive).to.be.a('function')
    })
  
    it('has all history functions', () => {
      const Example = Jangle.services.Example
      expect(Example.history).to.be.a('function')
      expect(Example.preview).to.be.a('function')
      expect(Example.restore).to.be.a('function')
    })
  
    it('has a live service', () => {
      const Example = Jangle.services.Example
      const LiveExample = Example.live
  
      expect(Example.live).to.exist
      expect(LiveExample.any).to.be.a('function')
      expect(LiveExample.count).to.be.a('function')
      expect(LiveExample.find).to.be.a('function')
      expect(LiveExample.get).to.be.a('function')
    })

  })

  describe('any', () => {

    it('requires a token', () =>
      Jangle.services.Example.any(undefined)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('returns a boolean', () =>
      Jangle.services.Example.any(Token)
        .then(hasAny => expect(hasAny).to.be.a('boolean'))
    )

    it('works without params', () =>
      Jangle.services.Example.any(Token)
    )

    it('accepts empty params', () =>
      Jangle.services.Example.any(Token, {})
    )

    it('accepts params with where clause', () =>
      Jangle.services.Example.any(Token, { where: { name: 'Ryan' } })
    )

  })

  describe('count', () => {

    it('requires a token', () =>
      Jangle.services.Example.count(undefined)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('returns a number', () =>
      Jangle.services.Example.count(Token)
        .then(count => expect(count).to.be.a('number'))
    )

    it('works without params', () =>
      Jangle.services.Example.count(Token)
    )

    it('accepts empty params', () =>
      Jangle.services.Example.count(Token, {})
    )

    it('accepts params with where clause', () =>
      Jangle.services.Example.count(Token, { where: { name: 'Ryan' } })
    )

  })

  describe('find', () => {

    it('requires a token', () =>
      Jangle.services.Example.find(undefined)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('returns a list of items', () =>
      Jangle.services.Example.find(Token)
        .then(items => {
          expect(items).to.be.an.instanceOf(Array)
        })
    )

    it('works without params', () =>
      Jangle.services.Example.find(Token)
    )

    it('accepts empty params', () =>
      Jangle.services.Example.find(Token, {})
    )

    it('accepts params with where clause', () =>
      Jangle.services.Example.find(Token, { where: { name: 'Ryan' } })
    )

    it('accepts params with multiple clauses', () =>
      Jangle.services.Example.find(Token, {
        where: { name: 'Ryan' },
        skip: 0,
        limit: 1,
        select: 'name'
      })
    )

  })

  describe('get', () => {

    const someId = new ObjectId()

    it('requires a token', () =>
      Jangle.services.Example.get(undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('requires an _id', () =>
      Jangle.services.Example.get(Token, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingId))
    )

    it('returns a single item', () =>
      Jangle.services.Example.get(Token, someId)
        .then(item => {
          expect(item).to.not.be.an.instanceOf(Array)
          expect(item).to.not.exist
        })
    )

    it('accepts empty params', () =>
      Jangle.services.Example.get(Token, someId, {})
    )

    it('accepts params with select clause', () =>
      Jangle.services.Example.get(Token, someId, { select: 'name' })
    )

  })

  let Item : IJangleItem = undefined
  let UpdateReturnedItem : IJangleItem = undefined
  let PatchReturnedItem : IJangleItem = undefined
  let RemovedItem : IJangleItem = undefined

  describe('create', () => {

    const someId = new ObjectId()

    const validItem = { name: 'Ryan', age: 24 }
    const invalidItem = { age: 24 }

    before(() =>
      Jangle.services.Example.create(Token, validItem)
        .then(item => { Item = item })
    )

    it('requires a token', () =>
      Jangle.services.Example.create(undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('requires an item', () =>
      Jangle.services.Example.create(Token, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingItem))
    )

    it('enforces required fields', () =>
      Jangle.services.Example.create(Token, invalidItem)
        .then(fail)
        .catch(reason => expect(reason).to.exist)
    )

    it('returns a single item', () => {
      expect(Item).to.not.be.an.instanceOf(Array)
      expect(Item).to.exist
      expect(Item._id).to.exist
    })

    it('creates jangle meta', () => {
      expect(Item.jangle).to.exist
      expect(Item.jangle.version).to.equal(1)
      expect(Item.jangle.created).to.exist
      expect(Item.jangle.created.by).to.eql(Item.jangle.updated.by)
      expect(Item.jangle.status).to.equal('visible')
    })

  })

  describe('update', () => {

    const validUpdate = { name: 'Ryan', age: 25 }
    const invalidUpdate = { age: 25 }

    before(() =>
      Jangle.services.Example.update(Token, Item._id, validUpdate)
        .then(item => { UpdateReturnedItem = item })
    )

    it('requires a token', () =>
      Jangle.services.Example.update(undefined, undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('requires an _id', () =>
      Jangle.services.Example.update(Token, undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingId))
    )

    it('requires an item', () =>
      Jangle.services.Example.update(Token, Item._id, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingItem))
    )

    it('enforces required fields', () =>
      Jangle.services.Example.update(Token, Item._id, invalidUpdate)
        .then(fail)
        .catch(reason => expect(reason).to.exist)
    )

    it('returns the old item', () => {
      expect(UpdateReturnedItem).to.eql(Item)
    })

  })

  describe('patch', () => {

    const validPatch = { age: 26 }

    before(() =>
      Jangle.services.Example.patch(Token, Item._id, validPatch)
        .then(item => { PatchReturnedItem = item })
    )

    it('requires a token', () =>
      Jangle.services.Example.patch(undefined, undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('requires an _id', () =>
      Jangle.services.Example.patch(Token, undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingId))
    )

    it('requires an item', () =>
      Jangle.services.Example.patch(Token, Item._id, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingItem))
    )

    it('returns the old item', () => {
      expect(PatchReturnedItem).to.exist
      expect(PatchReturnedItem.jangle).to.exist
      expect(PatchReturnedItem.jangle.version).to.equal(2)
    })

  })

  describe('remove', () => {

    before(() => 
      Jangle.services.Example.remove(Token, Item._id)
        .then(item => { RemovedItem = item })
    )

    it('requires a token', () =>
      Jangle.services.Example.remove(undefined, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(authErrors.invalidToken))
    )

    it('requires an _id', () =>
      Jangle.services.Example.remove(Token, undefined)
        .then(fail)
        .catch(reason => expect(reason).to.equal(errors.missingId))
    )

    it('returns the old item', () => {
      expect(RemovedItem).to.exist
      expect(RemovedItem.jangle).to.exist
      expect(RemovedItem.jangle.version).to.equal(3)
    })

  })

})
