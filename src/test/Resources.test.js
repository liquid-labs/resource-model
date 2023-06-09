/* global beforeEach describe expect test */
import fsPath from 'node:path'

import { Item } from '../Item'
import { Resources } from '../Resources'

const Foo = class extends Item { }

const fooConfig = {
  dataCleaner  : (data) => { delete data.deleteMe; return data },
  itemClass    : Foo,
  itemName     : 'foo',
  keyField     : 'name',
  resourceName : 'foos'
}

Item.bindCreationConfig(fooConfig)

describe('Resources', () => {
  describe('constructor', () => {
    test("raises an exception when initialized with 'readFromFile' and 'items' are true/present", () =>
      expect(() => new Resources({ fileName : 'foo.json', items : [{}], readFromFile : true })).toThrow())

    test("raises an exception when initialized with 'readFromFile' and no 'fileName", () =>
      expect(() => new Resources({ readFromFile : true })).toThrow())

    test('will load items from a file', () => {
      const dataPath = fsPath.join(__dirname, 'data', 'items.json')
      const resources =
        new Resources({ fileName : dataPath, readFromFile : true, itemConfig : fooConfig })
      expect(resources.list({ rawData : true })).toHaveLength(1)
    })

    test('raises an exception when non-unique items are found', () =>
      expect(() => new Resources({ itemConfig : { keyField : 'id' }, items : [{ id : 1 }, { id : 1 }] })).toThrow())

    test("raises an exception when 'id' is present but not the key field", () =>
      expect(() => new Resources({ itemConfig : Foo.itemConfig, items : [{ name : 'Bobby', id : 1 }] })).toThrow())

    test("raises an exception whin 'id' is the key field, but not defined", () =>
      expect(() => new Resources({ itemConfig : { keyField : 'id' }, items : [{ name : 'Bobby' }] })).toThrow())

    test("raises an exception when non-'id' key field is not defined", () =>
      expect(() => new Resources({ itemConfig : fooConfig, items : [{ id : 1 }] })).toThrow())
  })

  describe('get(id, { required: true })', () => {
    let foos
    beforeEach(() => {
      foos = new Resources({ itemConfig : Foo.itemConfig, items : [{ name : 'bar', deleteMe : true }] })
    })

    test('get({clean: true, rawData: true}) returns cleaned data', () =>
      expect('deleteMe' in foos.get('bar', { clean : true, rawData : true })).toBe(false))

    test("get({clean: true, rawData: true}) cleans normalized 'id' field when not part of the data", () =>
      expect('id' in foos.get('bar', { clean : true, rawData : true })).toBe(false))

    test('raises an exception when no matching resource found.', () =>
      expect(() => foos.get('a foo', { required : true })).toThrow(/Did not find required foo 'a foo'./))
  })
})
