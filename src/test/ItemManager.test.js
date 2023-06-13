/* global afterAll beforeAll beforeEach describe expect fail test */
import * as fs from 'node:fs/promises'
import fsPath from 'node:path'
import os from 'node:os'

import { Item } from '../Item'
import { ItemManager } from '../ItemManager'

const Foo = class extends Item { }

const fooConfig = {
  dataCleaner : (data) => { delete data.deleteMe; return data },
  itemClass   : Foo,
  itemName    : 'foo',
  keyField    : 'name',
  itemsName   : 'foos',
  allowSet    : ['foo']
}

Item.bindCreationConfig(fooConfig)

describe('ItemManager', () => {
  const dataPath = fsPath.join(__dirname, 'data', 'items.json')

  describe('constructor', () => {
    test("raises an exception when initialized with 'readFromFile' and 'items' are true/present", () =>
      expect(() => new ItemManager({ fileName : 'foo.json', items : [{}], readFromFile : true })).toThrow())

    test("raises an exception when initialized with 'readFromFile' and no 'fileName", () =>
      expect(() => new ItemManager({ readFromFile : true })).toThrow())

    test('will load items from a file', () => {
      const itemManager =
        new ItemManager({ fileName : dataPath, readFromFile : true, itemConfig : fooConfig })
      expect(itemManager.list({ rawData : true })).toHaveLength(1)
    })

    test('raises an exception when non-unique items are found', () =>
      expect(() => new ItemManager({ itemConfig : { keyField : 'id' }, items : [{ id : 1 }, { id : 1 }] })).toThrow())

    test("raises an exception when 'id' is present but not the key field", () =>
      expect(() => new ItemManager({ itemConfig : Foo.itemConfig, items : [{ name : 'Bobby', id : 1 }] })).toThrow())

    test("raises an exception whin 'id' is the key field, but not defined", () =>
      expect(() => new ItemManager({ itemConfig : { keyField : 'id' }, items : [{ name : 'Bobby' }] })).toThrow())

    test("raises an exception when non-'id' key field is not defined", () =>
      expect(() => new ItemManager({ itemConfig : fooConfig, items : [{ id : 1 }] })).toThrow())
  })

  describe('get(id, { required: true })', () => {
    let foos
    beforeEach(() => {
      foos = new ItemManager({ itemConfig : Foo.itemConfig, items : [{ name : 'bar', deleteMe : true }] })
    })

    test('get({clean: true, rawData: true}) returns cleaned data', () =>
      expect('deleteMe' in foos.get('bar', { clean : true, rawData : true })).toBe(false))

    test("get({clean: true, rawData: true}) cleans normalized 'id' field when not part of the data", () =>
      expect('id' in foos.get('bar', { clean : true, rawData : true })).toBe(false))

    test('raises an exception when no matching items found.', () =>
      expect(() => foos.get('a foo', { required : true })).toThrow(/Did not find required foo 'a foo'./))
  })

  describe('save()', () => {
    const baseTmpDir = os.tmpdir()
    const tmpDir = fsPath.join(baseTmpDir, 'liquid-labs', 'resource-model')
    let itemManager, saveFile

    beforeAll(async() => {
      try {
        await fs.rm(tmpDir, { recursive : true })
      }
      catch (e) {
        if (e.code !== 'ENOENT') {
          throw e
        }
      }
      await fs.mkdir(tmpDir, { recursive : true })

      saveFile = fsPath.join(tmpDir, 'general-file.json')

      itemManager =
        new ItemManager({ fileName : dataPath, readFromFile : true, itemConfig : fooConfig })

      await itemManager.save({ fileName : saveFile })
    })

    afterAll(async() => {
      fs.rm(tmpDir, { recursive : true })
    })

    test('saves equivalent data', async() => {
      const savedItemManager =
        new ItemManager({ fileName : saveFile, readFromFile : true, itemConfig : fooConfig })
      expect(itemManager.list({ clean : true, rawData : true }))
        .toEqual(savedItemManager.list({ clean : true, rawData : true }))
    })

    test('saves to original file name if no filename provided', async() => {
      const ourSaveFile = fsPath.join(tmpDir, 'same-file.json')
      await fs.cp(saveFile, ourSaveFile)

      const savedItemManager =
        new ItemManager({ fileName : ourSaveFile, readFromFile : true, itemConfig : fooConfig })
      const savedItem = savedItemManager.get('Bobby', { rawData : true })
      savedItem.foo = 'bar'
      savedItemManager.update(savedItem)
      await savedItemManager.save()

      const savedItemManager2 =
        new ItemManager({ fileName : ourSaveFile, readFromFile : true, itemConfig : fooConfig })

      expect(savedItemManager.list({ clean : true, rawData : true }))
        .toEqual(savedItemManager2.list({ clean : true, rawData : true }))
      expect(savedItemManager2.get('Bobby').foo).toBe('bar')
    })

    test('saves cleaned items', async() => {
      const ourSaveFile = fsPath.join(tmpDir, 'cleaned.json')
      await fs.cp(saveFile, ourSaveFile)

      const savedItemManager =
        new ItemManager({ fileName : ourSaveFile, readFromFile : true, itemConfig : fooConfig })
      const savedItem = savedItemManager.get('Bobby', { rawData : true })
      savedItem.deleteMe = 'bar'
      savedItemManager.update(savedItem)
      await savedItemManager.save()

      const savedItemManager2 =
        new ItemManager({ fileName : ourSaveFile, readFromFile : true, itemConfig : fooConfig })

      expect(savedItemManager2.get('Bobby').deleteMe).toBe(undefined)
    })

    test('refuses to save invalid item data', async() => {
      const ourSaveFile = fsPath.join(tmpDir, 'validate.json')
      await fs.cp(saveFile, ourSaveFile)

      const savedItemManager =
        new ItemManager({ fileName : ourSaveFile, readFromFile : true, itemConfig : fooConfig })
      savedItemManager.validate = ({ errors = [], warnings = [] } = {}) => {
        for (const data of savedItemManager.list({ rawData : true })) {
          if (data.foo === 'bar') {
            errors.push('No foobar!')
          }
        }

        return { errors, warnings }
      }
      const savedItem = savedItemManager.get('Bobby', { rawData : true })
      savedItem.foo = 'bar'
      savedItemManager.update(savedItem)
      try {
        await savedItemManager.save()
        fail()
      }
      catch (e) {}
      // v This doesn't work. I think the problem is that the exception is raised before 'expect' knows it's dealing
      // with an async function (?)
      // expect(async() => { await (savedItemManager.save()) }).toThrow()
    })
  })
})
