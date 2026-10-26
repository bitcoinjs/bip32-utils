const bitcoin = require('bitcoinjs-lib')
const bip32 = require('bip32')
const Account = require('../account')
const Chain = require('../chain')
const test = require('tape')
// Existing account tests mutate the shared fixture maps.
const f = JSON.parse(JSON.stringify(require('./fixtures/account')))

test('private JSON backups retain private derivation', function (t) {
  const account = Account.fromJSON(f.private.json)
  const json = JSON.stringify(account)

  t.same(JSON.parse(json), f.private.json, 'implicit serialization preserves private parents')
  t.same(JSON.parse(JSON.stringify({ account: account })).account, f.private.json, 'nested serialization preserves private parents')
  t.same(JSON.parse(JSON.stringify([account]))[0], f.private.json, 'array serialization preserves private parents')
  t.equal(JSON.stringify(account.toJSON()), json, 'explicit backup matches implicit serialization')

  const restored = Account.fromJSON(JSON.parse(json))
  t.equal(restored.getChain(0).getParent().isNeutered(), false, 'private backup restores a private parent')
  t.equal(restored.derive(f.addresses[0][0]).toBase58(), f.private.children[0][0], 'private backup restores the expected child key')
  t.end()
})

test('toPublicJSON exports private, public and mixed accounts as watch-only data', function (t) {
  const cases = [f.private.json, f.neutered.json, [f.private.json[0], f.neutered.json[1]]]

  cases.forEach(function (json) {
    const account = Account.fromJSON(json)
    const before = JSON.stringify(account)
    const parents = account.getChains().map(function (chain) { return chain.getParent() })
    const publicJSON = account.toPublicJSON()

    t.same(publicJSON, f.neutered.json, 'public keys, counters and address maps match the public fixture')
    t.same(JSON.parse(JSON.stringify({ account: publicJSON })).account, f.neutered.json, 'nested public serialization contains only the public representation')
    t.equal(JSON.stringify(account), before, 'public export leaves the original backup unchanged')
    parents.forEach(function (parent, i) {
      t.equal(account.getChain(i).getParent(), parent, 'public export does not replace the original parent')
    })

    const restored = Account.fromJSON(JSON.parse(JSON.stringify(publicJSON)))
    t.same(restored.toJSON(), f.neutered.json, 'public export restores as a watch-only account')
    f.addresses.forEach(function (addresses, i) {
      t.equal(restored.getChain(i).getParent().isNeutered(), true, 'restored parent has no private key')
      addresses.forEach(function (address, j) {
        t.equal(restored.derive(address).toBase58(), f.neutered.children[i][j], 'restores the expected public child')
      })
    })
  })
  t.end()
})

test('toPublicJSON does not serialize a private parent before neutering', function (t) {
  const account = Account.fromJSON(f.private.json)
  account.getChains().forEach(function (chain) {
    chain.getParent().toBase58 = function () {
      throw new Error('Private parent serialization must not be called')
    }
  })

  t.same(account.toPublicJSON(), f.neutered.json, 'public export never calls toBase58 on the private parent')
  t.end()
})

test('toPublicJSON preserves the network and lazy chain state', function (t) {
  const network = bitcoin.networks.testnet
  const parent = bip32.fromSeed(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'), network)
  const chain = new Chain(parent.deriveHardened(0), 7)
  const account = new Account([chain])
  const publicJSON = account.toPublicJSON()

  t.equal(publicJSON[0].k, 7, 'preserves the starting index')
  t.same(publicJSON[0].map, {}, 'does not populate a lazy address map')
  t.same(chain.addresses, [], 'does not derive addresses while exporting')
  t.equal(bip32.fromBase58(publicJSON[0].node, network).isNeutered(), true, 'uses the public key encoding for the selected network')

  const restored = Account.fromJSON(publicJSON, network)
  t.equal(restored.getNetwork(), network, 'preserves the supplied network on import')
  t.equal(restored.getChainAddress(0), account.getChainAddress(0), 'public and private accounts derive the same address')
  t.equal(chain.getParent().isNeutered(), false, 'original parent still holds its private key')
  t.end()
})

test('toPublicJSON handles an empty account', function (t) {
  t.same(new Account([]).toPublicJSON(), [], 'returns an empty array')
  t.end()
})
