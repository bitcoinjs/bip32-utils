const bitcoin = require('bitcoinjs-lib')
const bip32 = require('bip32')
const Chain = require('../chain')
const test = require('tape')
const fixtures = require('./fixtures/chain')
const createKeccakHash = require('keccak')

function segwitAddr (node) {
  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey: node.publicKey,
    network: bitcoin.networks.bitcoin
  })
  return p2wpkh.address
}

function ethAddr (node) {
  return '0x' + createKeccakHash('keccak256')
    .update(node.publicKey)
    .digest().toString('hex')
}

const AF_MAPPING = {
  eth: ethAddr,
  segwit: segwitAddr
}

fixtures.forEach(function (f) {
  const node = bip32.fromBase58(f.node)
  const addressFunction = AF_MAPPING[f.addressFunction]

  test('constructor', function (t) {
    let chain = new Chain(node, null, addressFunction)

    t.plan(3)
    t.equal(chain.k, 0, 'defaults to k=0')

    chain = new Chain(node, f.k, addressFunction)
    t.equal(chain.k, f.k, 'can start at a custom k value')

    chain = new Chain(node, f.k, addressFunction)
    t.equal(chain.addresses.length, 0, 'is lazy')
  })

  test('clone', function (t) {
    const chain = new Chain(node, null, addressFunction)
    let clone = chain.clone()

    t.plan(17)

    // by reference
    t.equal(chain.__parent, clone.__parent, 'same parent')

    // by value
    t.equal(chain.k, clone.k, 'k copied')
    t.notEqual(chain.addresses, clone.addresses, 'address arrays are different objects')
    t.same(chain.addresses, clone.addresses, 'address arrays are deep copied')
    t.notEqual(chain.map, clone.map, 'k maps are different objects')
    t.same(chain.map, clone.map, 'k map is deep copied')
    t.same(chain.addressFunction, clone.addressFunction, 'address function is copied')

    for (let i = 0; i < 7; ++i) chain.next()
    t.equal(clone.k, 0, 'k unchanged by mutation')
    t.notEqual(chain.k, clone.k, 'k unchanged by mutation (2)')
    t.notSame(chain.addresses, clone.addresses, 'address array unchanged by mutation')
    t.notSame(chain.map, clone.map, 'k map unchanged by mutation')

    // re-clone
    clone = chain.clone()

    // re-verify
    t.equal(chain.k, clone.k, 'k copied')
    t.notEqual(chain.addresses, clone.addresses, 'address arrays are different objects')
    t.same(chain.addresses, clone.addresses, 'address arrays are deep copied')
    t.notEqual(chain.map, clone.map, 'k maps are different objects')
    t.same(chain.map, clone.map, 'k map is deep copied')
    t.same(chain.addressFunction, clone.addressFunction, 'address function is copied')
  })

  test('find/derive', function (t) {
    const neutered = node.neutered()
    const chain = new Chain(neutered, f.k, addressFunction)

    t.plan(30)
    for (let i = 0; i < 10; ++i) {
      const address = chain.get()

      t.equal(chain.find(address), f.k + i)
      t.same(chain.derive(address), neutered.derive(f.k + i))
      t.same(chain.derive(address, node), node.derive(f.k + i))
      chain.next()
    }
  })

  test('get', function (t) {
    const chain = new Chain(node, f.k, addressFunction)
    chain.addresses = f.addresses

    t.plan(1)
    t.equal(chain.get(), f.addresses[f.addresses.length - 1], 'returns the last address')
  })

  test('next', function (t) {
    const chain = new Chain(node, f.k - f.addresses.length + 1, addressFunction)

    t.plan(f.addresses.length * 2 + 1)
    f.addresses.forEach(function (x, i) {
      t.equal(chain.get(), f.addresses[i], 'get returns the current address')

      if (f.addresses[i + 1]) {
        t.equal(chain.next(), f.addresses[i + 1], 'next returns the next address')
      }
    })

    t.equal(chain.k, f.k, 'results in the the expected k value')
    t.same(chain.map, f.map, 'results in the expected address map')
  })

  test('pop', function (t) {
    const chain = new Chain(node, null, addressFunction)
    chain.next()
    chain.next()
    const addresses = chain.getAll().concat()

    t.plan(8)
    t.equal(chain.getAll().length, 3, 'has 3 addresses')
    t.equal(chain.get(), addresses[2], 'matches the last address')
    chain.pop()
    t.equal(chain.getAll().length, 2, 'is now 1 less')
    t.equal(chain.get(), addresses[1], 'after pop, matches the second last')
    t.equal(chain.pop(), addresses[1], 'returns the popped address')
    t.equal(chain.getAll().length, 1, 'is now 1 less')
    t.equal(chain.pop(), addresses[0], 'returns the popped address')
    t.equal(chain.pop(), undefined, 'returns undefined when empty')
  })
})
