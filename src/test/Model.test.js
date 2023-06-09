/* globals describe expect test */
import { Item } from '../Item'
import { Model } from '../Model'
import { Resources } from '../Resources'

const SubItem = class extends Item {}

Item.bindCreationConfig({
  itemClass    : SubItem,
  itemName     : 'subItem',
  keyField     : 'id',
  resourceName : 'subItems'
})

const SubItems = class extends Resources {
  constructor(options) {
    super(Object.assign({}, options, { itemConfig : SubItem.itemConfig }))
  }
}

describe('Model', () => {
  describe('constructor', () => {
    test('succeeds with no options', () => expect(new Model()).toBeTruthy())

    test('binds initial resource roots', () => {
      const model = new Model({ resourceRoots : [new SubItems({ items : [{ id : 1 }] })] })
      expect(model.subItems).toBeTruthy()
      expect(model.subItems.get(1)).toBeTruthy()
    })
  })

  describe('bindRootResource', () => {
    test('binds the resource', () => {
      const model = new Model()
      model.bindRootResource(new SubItems({ items : [{ id : 1 }] }))
      expect(model.subItems).toBeTruthy()
      expect(model.subItems.get(1)).toBeTruthy()
    })
  })

  describe('validate', () => {
    test('does nothing if there are no validating resources or validators', () => {
      const model = new Model({ resourceRoots : [new SubItems({ items : [{ id : 1 }] })] })
      expect(() => model.validate()).not.toThrow()
    })

    test('will execute Resource validators', () => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      subItems.validate = () => throw new Error('Invalid!')
      const model = new Model({ resourceRoots : [subItems] })
      expect(() => model.validate()).toThrow()
    })

    test('will execute additional validators', () => {
      const subItems = new SubItems({ items : [{ id : 1 }] })
      const model = new Model({ resourceRoots : [subItems] })
      model.bindValidator({ validate : () => throw new Error('Invalid!') })
      expect(() => model.validate()).toThrow()
    })
  })
})
