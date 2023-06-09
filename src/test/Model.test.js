/* globals describe expect test */
import { Item } from '../Item'
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
    test('does nothing if there are no validating ItemManagers or validators', () => {
      const model = new Model({ rootItemManagers : [new SubItems({ items : [{ id : 1 }] })] })
      expect(() => model.validate()).not.toThrow()
    })

    test('will execute ItemManager validators', () => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      subItems.validate = () => throw new Error('Invalid!')
      const model = new Model({ rootItemManagers : [subItems] })
      expect(() => model.validate()).toThrow()
    })

    test('will execute additional validators', () => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      const model = new Model({ rootItemManagers : [subItems] })
      model.bindValidator({ validate : () => throw new Error('Invalid!') })
      expect(() => model.validate()).toThrow()
    })
  })
})
