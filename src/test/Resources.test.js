/* global describe expect test */

import { Item } from '../Item'
import { Resources } from '../Resources'

const Foo = class extends Item { }

const fooConfig = {
  itemClass    : Foo,
  itemName     : 'foo',
  keyField     : 'name',
  resourceName : 'foos'
}

Item.bindCreationConfig(fooConfig)

describe('Resources', () => {
  const foos = new Resources({ itemConfig : Foo.itemConfig })
  describe('get(id, { required: true })', () => {
    test('Raises an exception when no matching resourc found.', () => {
      expect(() => foos.get('a foo', { required : true })).toThrow(/Did not find required foo 'a foo'./)
    })
  })
})
