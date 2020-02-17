const bitcoinjs = require('bitcoinjs-lib')
const bip32 = require('bip32')
const Chain = require('../chain')
const discovery = require('../discovery')
const test = require('tape')

const fixtures = require('./fixtures/discovery')

fixtures.valid.forEach(function (f) {
  const network = bitcoinjs.networks[f.network]
  const external = bip32.fromBase58(f.external, network)
  const chain = new Chain(external, f.k)

  test('discovers until ' + f.expected.used + ' for ' + f.description + ' (GAP_LIMIT = ' + f.gapLimit + ')', function (t) {
    discovery(chain, f.gapLimit, function (addresses, callback) {
      return callback(null, f.used)
    }, function (err, used, checked) {
      t.plan(4)
      t.ifErr(err, 'no error')
      t.equal(used, f.expected.used, 'used as expected')
      t.equal(checked, f.expected.checked, 'checked count as expected')

      const unused = checked - used
      for (let i = 1; i < unused; ++i) chain.pop()

      t.equal(chain.get(), f.expected.nextToUse, 'next address to use matches')
    })
  })

  test('discover calls done on error', function (t) {
    const _err = new Error('e')

    discovery(chain, f.gapLimit, function (addresses, callback) {
      return callback(_err)
    }, function (err) {
      t.plan(1)
      t.equal(_err, err, 'error was returned as expected')
    })
  })
})
