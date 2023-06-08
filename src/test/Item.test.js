/* globals describe expect test */

import { Item } from '../Item'

const VAL_STRING = 'a string'
const VAL_INTEGER = 1
const VAL_OBJ = { string : 'nested string', object : { string : 'nested object string' } }
const VAL_ARRAY = [1, 'string', { string : 'object nested in array string' }]

const VAL_OVERRIDE_TRICK = 'tricked you!'

const data = {
  string  : VAL_STRING,
  integer : VAL_INTEGER,
  object  : VAL_OBJ,
  array   : VAL_ARRAY
}

const SubItem = class extends Item {
  subFunc() { return 'subfunc' }

  get bar() { return 'bar' }
}

Item.bindCreationConfig({
  dataCleaner  : (data) => { delete data.id; return data },
  itemClass    : SubItem,
  itemName     : 'sub-item',
  keyField     : 'integer',
  resourceName : 'sub-items'
})

const SubSubItem = class extends SubItem {
  subSubFunc() { return 'subsubfunc' }
}

Item.bindCreationConfig(Object.assign({},
  SubItem.itemConfig, {
    itemClass    : SubSubItem,
    itemName     : 'sub-sub-item',
    resourceName : 'sub-sub-items'
  }))

const TrickItem = class extends SubItem {
  get array() {
    return VAL_OVERRIDE_TRICK
  }
}

Item.bindCreationConfig(Object.assign({},
  SubItem.itemConfig, {
    itemClass    : TrickItem,
    itemName     : 'trick item',
    resourceName : 'trick items'
  }))

describe('Item', () => {
  // collection of common tests check access from class and subclass instances
  const basicAccessTests = (target, targetProto) => {
    test(`${target.constructor.name} has protoype ${targetProto}`, () =>
      expect(Object.getPrototypeOf(target)).toBe(targetProto))

    test.each([['string', VAL_STRING], ['integer', VAL_INTEGER]])('item.%s -> $p', (key, value) => {
      expect(target[key]).toBe(value)
    })

    test.each([
      ['object', VAL_OBJ],
      ['array', VAL_ARRAY]
    ])('will return distinct, equivalent %s values', (key, value) => {
      const ourValue = target[key]
      expect(ourValue).toEqual(value)
      expect(ourValue).not.toBe(value)
      ourValue.string = 'new string'
      expect(ourValue.string).not.toEqual(value.string)
    })

    test('blocks writes to valid keys', () => expect(() => { target.integer = 42 }).toThrow())

    test("will map the 'id' proerty", () => expect(target.id).toBe(1))

    test('.data -> a copy of the data', () => {
      const { data: dataCopy } = target
      expect(dataCopy).toEqual(data)
      expect(dataCopy).not.toBe(data)
    })

    test('.rawData -> the underlying data', () => {
      const { rawData } = target
      expect(rawData).toEqual(data)
      expect(rawData).toBe(data)
    })

    describe('private fields', () => {
      const Foo = class extends Item {
        #bar = 'bar'
        #baz

        constructor() {
          super({ name : 'the foo' })
          this.#baz = {}
          this.#baz.func = () => 'bazzy'
        }

        getBar() {
          return this.#bar
        }

        getBazzy() {
          return this.#baz.func()
        }

        get anotherBar() {
          return this.getBar()
        }
      } // class Foo
      Item.bindCreationConfig({ itemClass : Foo, itemName : 'foo', resourceName : 'foos', keyField : 'name' })
      const foo = new Foo()

      test('works with private value fields', () => expect(foo.getBar()).toBe('bar'))

      test('works with private object fields', () => expect(foo.getBazzy()).toBe('bazzy'))

      test('works with indirect private access', () => expect(foo.anotherBar).toBe('bar'))
    })
  } // end 'basicAcessTests' test builder

  test("Trying to create an Item directl ('new Item(data)') raises an exception", () => {
    expect(() => new Item(data)).toThrow('cannot be created directly')
  })

  describe('subclasses', () => {
    const subItem = new SubItem(data)
    const subItemKeys = Object.keys(subItem)
    const trickItem = new TrickItem(data)

    basicAccessTests(subItem, SubItem.prototype)

    test('defers to override getters/setters', () => expect(trickItem.array).toBe(VAL_OVERRIDE_TRICK))

    test('can call subclass functions', () => expect(subItem.subFunc()).toBe('subfunc'))

    test('subclass getters are \'in\' instances; e.g.: \'"bar" in subItem\' -> true', () => {
      expect('bar' in subItem).toBe(true)
    })

    // notice 'id' which is implicitly created if not specified
    const expectedSubItemKeys = ['array', 'id', 'integer', 'object', 'string']
    test(`data keys show up as enumerable; e.g. 'Object.subItem(keys) = ${expectedSubItemKeys.sort().join(', ')}'`,
      () => expect(subItemKeys.sort()).toEqual(expectedSubItemKeys.sort()))
  })

  describe('sub-subclasses', () => {
    const subSubItem = new SubSubItem(data)

    basicAccessTests(subSubItem, SubSubItem.prototype)

    test('can call subclass functions', () => expect(subSubItem.subFunc()).toBe('subfunc'))

    test('can call sub-sublass functions', () => expect(subSubItem.subSubFunc()).toBe('subsubfunc'))
  })
})
