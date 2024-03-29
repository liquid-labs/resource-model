/* globals describe expect fail test */
import { Item } from '@liquid-labs/resource-item'

import { ItemManager } from '../ItemManager'
import { Model } from '../Model'

const SubItem = class extends Item {}

Item.bindCreationConfig({
  itemClass : SubItem,
  itemName  : 'subItem',
  keyField  : 'id',
  itemsName : 'subItems'
})

const SubItems = class extends ItemManager {
  constructor(options) {
    super(Object.assign({}, options, { itemConfig : SubItem.itemConfig }))
  }
}

describe('Model', () => {
  describe('constructor', () => {
    test('succeeds with no options', () => expect(new Model()).toBeTruthy())

    test('binds initial root item managers', () => {
      const model = new Model({ rootItemManagers : [new SubItems({ items : [{ id : 1 }] })] })
      expect(model.subItems).toBeTruthy()
      expect(model.subItems.get(1)).toBeTruthy()
    })
  })

  describe('bindRootItemManager', () => {
    test('binds the ItemManager', () => {
      const model = new Model()
      model.bindRootItemManager(new SubItems({ items : [{ id : 1 }] }))
      expect(model.subItems).toBeTruthy()
      expect(model.subItems.get(1)).toBeTruthy()
    })
  })

  describe('validate', () => {
    test('does nothing if there are no validating ItemManagers or validators', async() => {
      const model = new Model({ rootItemManagers : [new SubItems({ items : [{ id : 1 }] })] })
      await model.validate()
    })

    test('will execute ItemManager validators', (done) => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      subItems.validate = () => throw new Error('Invalid!')
      const model = new Model({ rootItemManagers : [subItems] })

      model.validate()
        .then(() => {
          fail('Did not raise expected exception')
          done()
        })
        .catch((e) => done())
    })

    test('will execute sub-Model validators', (done) => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      subItems.validate = () => throw new Error('Invalid!')
      const subModel = new Model({ rootItemManagers : [subItems] })
      const model = new Model({ subModels : [{ name : 'subSpace', model : subModel }] })

      model.validate()
        .then(() => {
          fail('Did not raise expected exception')
          done()
        })
        .catch((e) => done())
    })

    test('will execute additional validators', (done) => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      const model = new Model({ rootItemManagers : [subItems] })
      model.bindValidator({ validate : () => throw new Error('Invalid!') })
      model.validate()
        .then(() => {
          fail('Did not raise expected exception')
          done()
        })
        .catch((e) => done())
    })
  })
})
