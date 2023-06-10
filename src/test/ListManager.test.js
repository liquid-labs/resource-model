// TODO: update tests to distinguish between implicit ID index and user added one-to-one indexes. See deletion tests for updated wording.

/* globals beforeAll describe expect test */
import { ListManager } from '../ListManager'
import { idxType } from '../lib/index-relationships'

const testItems = [
  { id : 1, type : 'foo', nestedObj : { data : 'Hi!' } },
  { id : 2, type : 'bar' },
  { id : 3, type : 'foo' }
]

const oneToOneSpec = { name : 'byId2', relationship : idxType.ONE_TO_ONE, indexField : 'id' }
const oneToManySpec = { name : 'byType', relationship : idxType.ONE_TO_MANY, indexField : 'type' }

const verifyOneToOneIndex = ({ index, items = testItems }) => {
  expect(Object.keys(index)).toHaveLength(items.length)
  for (const item of items) {
    expect(index[item.id]).toBe(item)
  }
}

const verifyOneToManyIndex = ({ index, items = testItems, expectedSize = 2, listSizes = { foo : 2, bar : 1 } }) => {
  expect(Object.keys(index)).toHaveLength(expectedSize)
  for (const key in index) { // eslint-disable-line guard-for-in
    expect(index[key]).toHaveLength(listSizes[key])
  }
  for (const item of items) {
    expect(index[item.type].includes(item)).toBe(true)
  }
}

describe('ListManager', () => {
  describe('contructor', () => {
    const items = [...testItems]
    const listManager = new ListManager({ items })
    const newId = items.length + 1
    const newItem = { id : newId, type : 'new' }
    const newListIdx = items.length

    beforeAll(() => {
      items.push(newItem)
      listManager.rebuildAll()
    })

    describe('constructor', () => {
      test('uses the list object itself', () => {
        expect(listManager.getItem(newId)).toEqual(newItem)
      })

      test('uses the items in the list', () => {
        // notice that we're twiddling the item we added to avoid polluting the original items
        items[newListIdx].testField = 10
        const retrievedItem = listManager.getItem(newId)
        expect(retrievedItem.testField).toBe(10)
      })
    })

    describe('getItems', () => {
      const items = [...testItems]
      const listManager = new ListManager({ items })
      const defaultItems = listManager.getItems()
      const clonedItems = listManager.getItems({ cloneAll : true })

      test('returns fully cloned list + items by default', () => {
        delete defaultItems.getSafe
        expect(items).toEqual(defaultItems)
        expect(items).not.toBe(defaultItems)
        expect(items[0]).not.toBe(defaultItems[0])
      })

      test("'cloneAll : true' results in unique list and items", () => {
        expect(items).toEqual(clonedItems)
        expect(items).not.toBe(clonedItems)
        expect(items[0]).toEqual(clonedItems[0])
        expect(items[0]).not.toBe(clonedItems[0])
      })
    })

    describe('getItem', () => {
      const items = [...testItems]
      const listManager = new ListManager({ items })
      const itemGet = listManager.getItem(1)
      const itemOrig = items[0]

      test('creates an independent copy of the managed object', () => {
        expect(itemGet).toEqual(itemOrig)
        expect(itemGet).not.toBe(itemOrig)
      })

      test('performs a deep copy', () => {
        expect(itemGet.nestedObj).toEqual(itemOrig.nestedObj)
        expect(itemGet.nestedObj).not.toBe(itemOrig.nestedObj)
      })
    })

    describe('getByIndex', () => {
      const items = [...testItems]
      const listManager = new ListManager({ items })
      const indexMap = {} // we can't use 'byId', etc. directly in our 'each' arrays because they get eval before before

      beforeAll(() => {
        const byId = listManager.getIndex('byId')
        indexMap.byId = byId
        const oneToOne = listManager.addIndex(oneToOneSpec)
        indexMap[oneToOneSpec.name] = oneToOne
        const anonymousSpec = Object.assign({}, oneToManySpec)
        delete anonymousSpec.name
        const anonymousOneToMany = listManager.addIndex(anonymousSpec)
        indexMap.anon = anonymousOneToMany
      })

      test.each(['byId', oneToOneSpec.name])("can reference '%s' index by name, getting a copy", (indexName) => {
        const result = listManager.getByIndex({ indexName, key : 1 })
        expect(result).toEqual(items[0])
        expect(result).not.toBe(items[0])
      })

      test.each(['byId', oneToOneSpec.name])("can use '%s' index ref, getting a copy", (indexName) => {
        const index = indexMap[indexName]
        const result = listManager.getByIndex({ index, key : 1 })
        expect(result).toEqual(items[0])
        expect(result).not.toBe(items[0])
      })
    })

    describe('addIndex', () => {
      const items = [...testItems]
      const listManager = new ListManager({ items })
      let oneToOne, oneToMany, anonymous

      beforeAll(() => {
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)
        const anonymousSpec = Object.assign({}, oneToManySpec)
        delete anonymousSpec.name
        anonymous = listManager.addIndex(anonymousSpec)
      })

      test('properly initalizes implicit one-to-on index', () => verifyOneToOneIndex({ index : oneToOne }))

      test('properly initializes one-to-many index', () => verifyOneToManyIndex({ index : oneToMany }))

      test('properly initalizes anonymous indexes', () => verifyOneToManyIndex({ index : anonymous }))
    })

    describe('indexCounts', () => {
      const listManager = new ListManager({ items : [...testItems] })

      beforeAll(() => {
        const anonymousSpec = Object.assign({}, oneToManySpec)
        delete anonymousSpec.name
        listManager.addIndex(anonymousSpec)
      })

      test('has 1 named index', () => expect(listManager.getNamedIndexCount()).toBe(1))

      test('has 2 indexes total', () => expect(listManager.getTotalIndexCount()).toBe(2))
    })

    describe('rebuild', () => {
      describe('for one-to-one indexes', () => {
        const items = [...testItems]
        const listManager = new ListManager({ items })
        let index

        beforeAll(() => {
          index = listManager.getIndex('byId')
          items.splice(2, 1) // remove id: 3
          items.push({ id : 8, type : 'new' })
          listManager.rebuild({ indexField : 'id', relationship : idxType.ONE_TO_ONE, index })
        })

        test('builds a valid one-to-one index', () => verifyOneToOneIndex({ index, items }))

        test('removes old entries', () => expect(index[3]).toBeUndefined())
      }) // end rebuild/one-to-one

      describe('for one-to-many indexes', () => {
        const items = [...testItems, { id : 8, type : 'old' }]
        const listManager = new ListManager({ items })
        let index

        beforeAll(() => {
          index = listManager.addIndex(oneToManySpec)
          items.splice(items.length - 1, 1) // id: 8
          listManager.rebuild('byType')
        })

        test('creates a valid one-to-many index', () => verifyOneToManyIndex({ index }))

        test('removes old entries', () => expect(index.old).toBeUndefined())
      }) // end rebuild/one-to-many
    }) // end rebuild

    describe('rebuildAll', () => {
      const items = [...testItems, { id : 8, type : 'old' }]
      const listManager = new ListManager({ items })
      let oneToOne, oneToMany

      beforeAll(() => {
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)
        items.splice(items.length - 1, 1)
        listManager.rebuildAll()
      })

      test('properly rebuilds multiple indexes', () => {
        verifyOneToOneIndex({ index : oneToOne })
        verifyOneToManyIndex({ index : oneToMany })
      })

      test('removes old entries', () => {
        expect(oneToOne[8]).toBeUndefined()
        expect(oneToMany.old).toBeUndefined()
      })
    })

    describe('addItem', () => {
      let oneToOne, oneToMany
      const items = [...testItems]
      const item7 = { id : 7, type : 'foo' }
      const item8 = { id : 8, type : 'new' }
      const listManager = new ListManager({ items })

      beforeAll(() => {
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)

        listManager.addItem(item7)
        listManager.addItem(item8)
      })

      test('properly updates one-to-one indexes', () => {
        verifyOneToOneIndex({ index : oneToOne, items : listManager.getItems({ noClone : true }) })
        expect(oneToOne[7]).toBe(item7)
      })

      test('properly updates one-to-many indexes', () => {
        verifyOneToManyIndex({
          index        : oneToMany,
          items        : listManager.getItems({ noClone : true }),
          expectedSize : 3,
          listSizes    : { foo : 3, bar : 1, new : 1 }
        })
        expect(oneToMany.new[0]).toBe(item8)
      })
    })

    describe('updateItem', () => {
      let oneToOne, oneToMany
      const items = [...testItems]
      const newItem = { id : 3, type : 'new' }

      beforeAll(() => {
        const listManager = new ListManager({ items })
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)

        listManager.updateItem(newItem)
      })

      test('properly updates one-to-one indexes', () => {
        verifyOneToOneIndex({ index : oneToOne, items })
        expect(oneToOne[3]).toBe(newItem)
      })

      test('properly updates one-to-many indexes', () => {
        verifyOneToManyIndex({ index : oneToMany, items, expectedSize : 3, listSizes : { foo : 1, bar : 1, new : 1 } })
        expect(oneToMany.new[0]).toBe(newItem)
      })
    })

    describe('deleteItem', () => {
      let expectedItems, oneToOne, oneToMany, itemToDelete

      beforeAll(() => {
        expectedItems = [testItems[0], testItems[1]]

        const listManager = new ListManager({ items : [...testItems] })
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)

        itemToDelete = testItems[2]
        listManager.deleteItem(itemToDelete)
      })

      test('deletes from ID index', () => {
        verifyOneToOneIndex({ index : oneToOne, items : expectedItems })
        expect(oneToOne[3]).toBeUndefined()
      })

      test('deletes from one-to-many index', () => {
        verifyOneToManyIndex({ index : oneToMany, items : expectedItems, expectedSize : 2, listSizes : { foo : 1, bar : 1 } })
        expect(oneToMany.foo[0]).not.toBe(itemToDelete)
      })

      test('can delete a second item', () => {
        const listManager = new ListManager({ items : [...testItems] })
        const oneToOne = listManager.getIndex('byId')
        const oneToMany = listManager.addIndex(oneToManySpec)

        listManager.deleteItem(testItems[2])
        listManager.deleteItem(testItems[0])
        const expectedItems = [testItems[1]]

        verifyOneToOneIndex({ index : oneToOne, items : expectedItems })
        verifyOneToManyIndex({ index : oneToMany, items : expectedItems, expectedSize : 1, listSizes : { bar : 1 } })
      })
    })

    describe('truncate', () => {
      let listManager, oneToOne, oneToMany
      const items = [...testItems]

      beforeAll(() => {
        listManager = new ListManager({ items })
        oneToOne = listManager.getIndex('byId')
        oneToMany = listManager.addIndex(oneToManySpec)

        listManager.truncate()
      })

      test('truncation removes all item from the list',
        () => expect(listManager.getItems({ noClone : true })).toHaveLength(0))

      test('clears the ID index', () => {
        expect(oneToOne[1]).toBe(undefined)
        expect(Object.keys(oneToOne)).toHaveLength(0)
      })

      test('clears secondary index', () => {
        expect(oneToMany.foo).toBe(undefined)
        expect(Object.keys(oneToMany)).toHaveLength(0)
      })
    })
  })
})
