import * as fs from 'node:fs/promises'

import { getSourceFile, readFJSON } from '@liquid-labs/federated-json'

import { ListManager } from './ListManager'
import { Item } from './Item'

const passthruNormalizer = (id) => id

/**
* Common class for base item manager support simple get and list functions.
*/
const ItemManager = class {
  #itemConfigCache
  #itemCreationOptions
  #fileName
  /**
  * Internal 'by ID' index.
  */
  #indexById

  constructor({
    allowNoFile = false,
    fileName,
    indexes = [],
    additionalItemCreationOptions = {},
    // TODO: if itemName not specified, deduce from 'itemClass'
    items = [],
    readFromFile = false,
    itemConfig
  }) {
    // set the source file
    this.#fileName = fileName || (items !== undefined && getSourceFile(items))
    // set manuall set itemConfig
    this.#itemConfigCache = itemConfig || this.constructor.itemConfig
    // read from source file if indicated
    if (readFromFile === true && items && items.length > 0) {
      throw new Error(`Cannot specify both 'readFromFile : true' and 'items' when loading ${this.itemsName}.`)
    }
    if (readFromFile === true && !fileName) {
      throw new Error(`Must specify 'fileName' when 'readFromFile : true' while loading ${this.itemsName}.`)
    }

    // setup ListManager
    this.listManager = new ListManager({
      className    : this.itemsName,
      keyField     : this.keyField,
      idNormalizer : this.idNormalizer
    })

    // setup indexes
    this.#indexById = this.listManager.getIndex('byId')
    this.#itemCreationOptions = Object.assign({},
      additionalItemCreationOptions
    )
    this.#addIndexes(indexes)

    if (this.keyField !== 'id') {
      const origDataCleaner = this.#itemConfigCache.dataCleaner
      const newCleaner = origDataCleaner === undefined
        ? (data) => { delete data.id; return data }
        : (data) => {
          delete data.id
          return origDataCleaner(data)
        }
      this.#itemConfigCache = Object.assign({}, this.#itemConfigCache, { dataCleaner : newCleaner })
      Object.freeze(this.#itemConfigCache)
    }

    if (readFromFile === true) {
      this.load({ allowNoFile })
    }
    else {
      this.load({ items })
    }
  }

  // item config convenience accessors
  get dataCleaner() { return this.#itemConfigCache.dataCleaner }

  get dataFlattener() { return this.#itemConfigCache.dataFlattener }

  /**
  * See [Item.idNormalizer](./Item.md#idnormalizer)
  */
  get idNormalizer() { return this.#itemConfigCache.idNormalizer || passthruNormalizer }

  get itemClass() { return this.#itemConfigCache.itemClass }

  get itemName() { return this.#itemConfigCache.itemName }

  /**
  * See [Item.keyField](./Item.md#keyfield)
  */
  get keyField() { return this.#itemConfigCache.keyField }

  get itemsName() { return this.#itemConfigCache.itemsName }

  add(data) {
    data = ensureRaw(data)
    const keyField = this.keyField
    const hasExplicitId = keyField === 'id'

    // add standard 'id' field if not present.
    if (data[keyField] === undefined) {
      throw new Error(`Key field '${keyField}' not found on at least one item while loading ${this.itemsName}.`)
    }
    if (hasExplicitId === false && 'id' in data) {
      throw new Error(`Inferred/reserved 'id' found on at least one ${this.itemName} item (key field is: ${this.keyField}) while loading ${this.itemsName}.`)
    }

    // normalize ID
    if (data.id === undefined) data.id = this.idNormalizer(data[keyField])

    if (this.has(data.id)) {
      throw new Error(`Cannot add ${this.itemName} with existing key '${data.id}' (field: ${this.keyField}); try 'update'.`)
    }

    this.listManager.addItem(data)
  }

  /**
  * Retrieves a single vendor/product entry by name.
  *
  * Options:
  * - `dataAugmentor`: used to augment the base data, such as with implied or context driven data that isn't reflected
  *   in the raw data structure. This is intendend for use by ItemManagers and should not be used by end users.
  */
  get(id, { dataAugmentor, ...options } = {}) {
    let data = this.#indexById[id]
    if (dataAugmentor !== undefined && data !== undefined) {
      data = structuredClone(this.#indexById[id])
      dataAugmentor(data)
    }
    // TODO: if data augmented, then we could signal to skip the structuredClone that happens here
    return this.#dataToItem(data, Object.assign({}, options || {}, { id }))
  }

  has(name) { return !!this.#indexById[name] }

  load({ allowNoFile = false, items } = {}) {
    if (!this.#fileName && items === undefined) {
      throw new Error(`No 'file name' defined for ${this.itemsName} ItemManager; cannot 'load'.`)
    }

    this.truncate()
    // TODO: really just want JSON and YAML agnostic processing; federated is overkill
    try {
      items = items || readFJSON(this.#fileName)
      for (const item of items) {
        this.add(item)
      }
    }
    catch (e) {
      if (allowNoFile !== true || e.code !== 'ENOENT') {
        throw (e)
      }
      // else, that's OK
    }
  }

  update(data, { skipGet = false, ...rest } = {}) {
    data = ensureRaw(data)
    const id = data[this.keyField]
    if (!this.has(id) === undefined) {
      throw new Error(`No such ${this.itemName} with key '${id}' to update; try 'add'.`)
    }

    this.listManager.updateItem(data)

    if (skipGet === true) return
    // else
    return this.get(id, rest)
  }

  delete(itemId, { required = false } = {}) {
    itemId = this.idNormalizer(itemId)
    const item = this.#indexById[itemId]
    if (required === true && item === undefined) {
      throw new Error(`No such item with id '${item.id}' found.`)
    }

    this.listManager.deleteItem(item)
  }

  /**
  * Returns a list of the items.
  *
  * ### Parameters
  * - `dataAugmentor`: used to augment the base data, such as with implied or context driven data that isn't reflected
  *   in the raw data structure. This is intendend for use by ItemManagers and should not be used by end users.
  * - `rawData`: if true, then JSON structures will be returned rather than full objects.
  * - `sort`: the field to sort on. Defaults to 'id'. Set to `false` for unsorted and slightly faster results.
  * - `sortFunc`: a specialized sort function. If provided, then `sort` will be ignored, even if `false`.
  */
  list({ dataAugmentor, sort = this.keyField, sortFunc, ...rest } = {}) {
    let items
    if (dataAugmentor === undefined) {
      // then we can optimize by using the raw data, which is cloned later it 'dataToList'
      // 'noClone' provides the underlying list itself; since we (usually) sort, we copy through unrolling
      items = [...this.listManager.getItems({ noClone : true })]
    }
    else { // then we want the raw data, but need it to be cloned because it's going to be manipulated
      items = this.listManager.getItems({ rawData : true })
      for (const item of items) {
        dataAugmentor(item)
      }
    }

    // TODO: if data is augmented, we can skip the structuredClone that happens in #dataToList because it's already copied.
    const resultItems = this.#dataToList(items, rest)
    if (sortFunc !== undefined) {
      resultItems.sort(sortFunc)
    }
    else if (sort !== false) {
      resultItems.sort(fieldSort(sort))
    }

    return resultItems
  }

  truncate() {
    this.listManager.truncate()
  }

  async save({ fileName = this.#fileName, noValidate = false } = {}) {
    if (!fileName) {
      throw new Error(`Cannot write '${this.itemsName}' database no file name specified. Ideally, the file name is captured when the DB is initialized. Alternatively, it can be passed to this function as an option.`)
    }

    if (this.validate !== undefined && noValidate !== true) {
      const { errors } = this.validate()
      if (errors.length > 0) {
        throw new Error('Item data is invalid; refusing to save.')
      }
    }

    let itemList = this.list({ rawData : true }) // now we have a deep copy, so we don't have to worry about changes
    if (this.dataCleaner) {
      itemList = itemList.map((i) => this.dataCleaner(i))
    }
    await fs.writeFile(fileName, JSON.stringify(itemList, null, '  '))
  }

  #addIndexes(indexes) {
    for (const { indexField, relationship } of indexes) {
      this.listManager.addIndex({
        name : indexField,
        indexField,
        relationship
      })

      const functionName = `getBy${indexField[0].toUpperCase() + indexField.slice(1)}`
      this[functionName] = this.getByIndex.bind(this, indexField)
    }
  }

  /**
  * A 'safe' creation method that guarantees the creation options defined in the Item constructor will override the
  * incoming options.
  */
  createItem(data, options) {
    return new this.itemClass(data, Object.assign({}, options, this.#itemCreationOptions)) // eslint-disable-line new-cap
  }

  #dataToItem(data, { clean = false, required = false, rawData = false, id, errMsgGen, ...rest } = {}) {
    if (clean === true && rawData === false) {
      throw new Error('Incompatible options; \'clean = true\' requires \'raw data = true\'')
    }
    if (required === true && data === undefined) {
      errMsgGen = errMsgGen || (() => `Did not find required ${this.itemName}${id ? ` '${id}'` : ''}.`)
      throw new Error(errMsgGen())
    }

    if (data === undefined) return undefined
    if (rawData === true) {
      data = structuredClone(data)
      // TODO: is this necessary? Or can we rely on prior behavior to have guaranteed ID by this point?
      data.id = data[this.keyField]
      return clean === true ? this.dataCleaner(data) : data
    }
    // else
    return this.createItem(data, rest)
  }

  #dataToList(data, { clean = false, rawData = false } = {}) {
    return rawData !== true
      ? data.map((data) => this.createItem(data))
      : clean === true && this.dataCleaner
        ? data.map((i) => this.dataCleaner(structuredClone(i)))
        : structuredClone(data)
  }

  getByIndex(indexName, key, options) {
    const result = this.listManager.getByIndex({ indexName, key, noClone : true })
    if (Array.isArray(result)) {
      return this.#dataToList(result, options)
    }
    else {
      return this.#dataToItem(result, Object.assign(options || {}, { id : key }))
    }
  }
}

const fieldSort = (field) => (a, b) => a[field].localeCompare(b[field])

const ensureRaw = (data) => data instanceof Item ? data.data : structuredClone(data)

export { ItemManager }
