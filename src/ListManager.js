import * as relationships from './lib/index-relationships'

/**
* Manages simple a set of items and value-field one-to-one and one-to-many indexes. Intended for use with a set of items
* of the same "class". It is essential that items retrieved are cloned before modification and the class provides
* 'getItem' to retrieve by the ID and 'getByIndex' which will retrieve items from any named or anonymous index.
*
* Because 'getByIndex' may return a list of associated objects, it will, by default, return an NON-cloned array. The
* array will, however, have the function '.getSafe(index)' which will clone safely clone the objects for modification.
*
* An implicit 'byId' index, which can be retrieved via `listManager.getIndex('byId')` (or whatever you configure as
* the `idIndexName`) is implicitly created and cannot be deleted. Items can be read, but be careful when using items
* from the index directly changing fields could pollute the indexes and result in inconsistent and erroneous behavior.
* Instead, use the access methods mentioned above.
*
* ## Usage requirements
*
* - Items must have an ID field which uniquely identifies each item in the set.
* - The ID field _*must*_ be effectively immutable.
* - Items returned to the user _*must*_ be copied.
*
* ## Implementation notes
*
* The implicity 'byId' index is necessary to manage item updates where it is necessary to identify the previous item
* in order to properly update the non-ID indexes.
*/
const ListManager = class {
  #indexSpecs = []
  #specIndex = {}
  #items
  #idIndex
  #keyField
  #className

  /**
  * #### Parameters
  *
  * - items: The list of items to build our index manager around. Note that the list will NOT be copied and will be used
  *     as is. External modifications to the list or any items within it will break and cause undefined behavior. Copy
  *     the incoming list with something like `items: [...items]` unless you can guarantee that the array will not be
  *     modified.
  */
  constructor({ items, keyField = 'id', idIndexName = 'byId', className }) {
    this.#items = items
    this.#keyField = keyField
    this.#idIndex = this.addIndex({
      name         : 'byId',
      indexField   : keyField,
      relationship : relationships.ONE_TO_ONE
    })
    this.#className = className
  }

  get keyField() { return this.#keyField }

  /**
  * ## Retriewal functions
  */

  /**
  * Retrieves the list. By default, the list is copied but the items are not. However, a 'getSafe(listIndex)' function
  * is attached to the array which can be used to make update safe copies of the items in the list.
  *
  * #### Parameters
  *
  * - `cloneAll`: Preimptively deep-clones all items in the list. Both the list and items will be unique and
  *      independent. The `getSafe` function is not attached since everything is already cloned.
  * - `noClone`: returns the underlying list itself. `noClone` is ignored if `cloneAll` is `true`.
  */
  getItems({ cloneAll, cloneList, noClone } = {}) {
    if (cloneAll === true) {
      return structuredClone(this.#items)
    }
    if (cloneList === true) {
      return [...this.#items]
    }
    if (noClone === true) {
      return this.#items
    }
    // else return default
    return structuredClone(this.#items)
  }

  /**
  * Retrieves a singel item by id.
  *
  * #### Parameters
  *
  * - id: the ID of the item to be retrieved.
  * - className: (optional) the name item class; e.g. 'car', 'animal', etc. Used to produce error messages and defaults *     to the class name set when creating listManager Generally, it's recommended to set the class name when
  *     creating the ListManager instance rather than here, though there may be some cases where it is useful to
  *     override the default value.
  * - noClone: (optional) when set 'true', skips cloning the returned item. This should generally only be used when it
  *     can be guaranteed that the returned object will not be modified in any way.
  * - requried: (optional) when set `true`, causes an error to be thrown if no item is found with the given `id`.
  */
  getItem(id, { noClone = false, required = false, className = this.#className } = {}) {
    const item = this.#idIndex[id]
    if (item === undefined && required === true) {
      throw new Error(`No such ${className || 'item'} with id '${id}' found.`)
    }

    return noClone ? item : structuredClone(item)
  }

  /**
  * Returns the index value, which may be a single item (for one-to-one indexes) or a list of items (for one-to-many
  * indexes). In the one-to-one case, the item returned is cloned by default. To avoid unecessary expense, the list is
  * not cloned in the one-to-many case unless 'cloneAll' is set to true. Rather, a 'getSafe(listIndex)' function is
  * attached to the array for convenience.
  *
  * #### Parameters
  *
  * - `index`: a reference to the index to use; either `index` or `indexName` must be specified and `index` is
  *      preferred if both are specified.
  * - `indexName`: the name of the index to use. See `index`.
  * - `key`: the index key to lookup.
  * - className: (optional) the name item class; e.g. 'car', 'animal', etc. Used to produce error messages and defaults *     to the class name set when creating listManager Generally, it's recommended to set the class name when
  *     creating the ListManager instance rather than here, though there may be some cases where it is useful to
  *     override the default value.
  * - `cloneAll`: (optional) preemptively clones each member in a one-to-many list. `cloneAll` supercedes `noClone` and
  *      will also cause single items (from a one-to-one index) to be cloned even if `noClone` is `true`.
  * - `noClone`: (optional) will skip item cloning or attaching `getSafe` to list results unless `cloneAll` is also
  *     `true`.
  * - `required`: (optional) will raise an error if the index value is undefined.
  */
  getByIndex({
    index,
    indexName,
    key,
    noClone = false,
    required = false,
    cloneAll = true,
    cloneList,
    className = this.#className
  }) {
    // Note, indicating a valid index is always required and '#getIndex' spec will throw an error if no match is found.
    const { index: indexActual, name, relationship } = this.#getIndexSpec(index || indexName)
    const value = indexActual[key]
    // value requied?
    if (value === undefined && required === true) {
      indexName = indexName || name
      throw new Error(`Did not find ${className ? `${className} for ` : ''}key '${key}' in index${indexName ? ` '${indexName}'` : ''}.`)
    }

    if (relationship === relationships.ONE_TO_ONE) {
      if (cloneAll === true) return structuredClone(value)
      else if (noClone === true) return value
      else return structuredClone(value)
    }
    else { // list
      if (value === undefined) {
        return []
      }
      else if (cloneAll === true) {
        return value.map((i) => structuredClone(i))
      }
      else if (cloneList === true) {
        return [...value]
      }
      else if (noClone === true) {
        return value
      }
      else {
        return value.map((i) => structuredClone(i))
      }
    }
  }

  addIndex(indexSpec) {
    for (const reqField of ['relationship', 'indexField']) {
      if (indexSpec[reqField] === undefined) {
        throw new Error(`Index spec lacks required field '${reqField}'.`)
      }
    }

    const index = {}
    indexSpec = { index, ...indexSpec }
    this.#indexSpecs.push(indexSpec)
    if (indexSpec.name !== undefined) {
      this.#specIndex[indexSpec.name] = indexSpec
    }
    this.rebuild(indexSpec)

    return index
  }

  getIndex(name) { return this.#getIndexSpec(name).index }

  getNamedIndexCount() { return Object.keys(this.#specIndex).length }

  getTotalIndexCount() { return this.#indexSpecs.length }

  rebuild(specOrIndex) {
    const indexSpec = typeof specOrIndex === 'string' ? this.#getIndexSpec(specOrIndex) : specOrIndex
    routeByRelationship({
      items        : this.#items,
      indexSpec,
      one2oneFunc  : rebuildOneToOne,
      one2manyFunc : rebuildOneToMany
    })
  }

  rebuildAll() {
    routeByRelationships({
      items        : this.#items,
      indexSpecs   : this.#indexSpecs,
      keyField     : this.#keyField,
      one2oneFunc  : rebuildOneToOne,
      one2manyFunc : rebuildOneToMany
    })
  }

  addItem(item) {
    this.#items.push(item)

    routeByRelationships({
      item,
      indexSpecs   : this.#indexSpecs,
      one2oneFunc  : addOneToOne,
      one2manyFunc : addOneToMany
    })
  }

  /**
   * Deletes all items from the list. This clears both the list and rebuilds all indexes.
   */
  truncate() {
    this.#items = []
    this.rebuildAll()
  }

  updateItem(item) {
    // this.getItem(item[this.#idIndex])
    // check that this is a valid update
    this.getItem(item[this.#keyField], { required : true, noClone : true })
    // In future, we could keep the base list sorted by ID and then use quick-sort insertion and update techniques. For
    // now, we just brute force it.
    const itemIndex = this.#items.findIndex((i) => i.id === item.id)
    this.#items.splice(itemIndex, 1, item)

    routeByRelationships({
      item,
      keyField     : this.#keyField,
      idIndex      : this.#idIndex,
      indexSpecs   : this.#indexSpecs,
      one2oneFunc  : updateOneToOne,
      one2manyFunc : updateOneToMany
    })
  }

  deleteItem(item) {
    // check that this is a valid delete TODO: replace this with 'hasItem'
    this.getItem(item[this.#keyField], { required : true, noClone : true })

    try {
      const itemIndex = this.#items.findIndex((i) => i.id === item.id)
      this.#items.splice(itemIndex, 1)

      routeByRelationships({
        item,
        keyField     : this.#keyField,
        idIndex      : this.#idIndex,
        indexSpecs   : this.#indexSpecs,
        one2oneFunc  : deleteOneToOne,
        one2manyFunc : deleteOneToMany
      })
    }
    catch (e) {
      throw new Error(`There was a problem deleting item '${item[this.#keyField]}'.`, { cause : e })
    }
  }

  #getIndexSpec(nameOrIndex) {
    const indexSpec = typeof nameOrIndex === 'string'
      ? this.#specIndex[nameOrIndex]
      : this.#indexSpecs.find((spec) => spec.index === nameOrIndex)
    if (indexSpec === undefined) {
      const msg = typeof nameOrIndex === 'string'
        ? `No such index '${nameOrIndex}' found.`
        : 'Could not find matching index.'
      throw new Error(msg)
    }
    return indexSpec
  }

  #getIdIndexKey() {
    return this.#indexSpecs[0].keyField // the 'ID index' is always first
  }

  #annotateList(list) {
    list.getSafe = (idx) => structuredClone(list[idx])
    return list
  }
}

/**
* ## Helpers
* ### Internal plumbing
*/
const truncateObject = (o) => {
  for (const key of Object.getOwnPropertyNames(o)) {
    delete o[key]
  }
}

const routeByRelationship = ({ indexSpec, one2oneFunc, one2manyFunc, ...rest }) => {
  switch (indexSpec.relationship) {
  case relationships.ONE_TO_ONE: one2oneFunc({ ...indexSpec, ...rest }); break
  case relationships.ONE_TO_MANY: one2manyFunc({ ...indexSpec, ...rest }); break
    // TODO: include this check in 'addIndex'
  default: throw new Error(`Unknown index relationship spec ('${indexSpec.relationship}')`)
  }
}

const routeByRelationships = ({ indexSpecs, ...args }) => {
  // the reversal is necessary to preserve the original item stored in the implicit, first ID index
  // the array copy is necessary because 'reverse' work in-place
  for (const indexSpec of [...indexSpecs].reverse()) {
    routeByRelationship({ indexSpec, ...args })
  }
}

// ### Rebuild helpers
const rebuildOneToOne = ({ items, index, indexField }) => {
  truncateObject(index)
  items.reduce((newIdx, item) => { newIdx[item[indexField]] = item; return newIdx }, index)
}

const rebuildOneToMany = ({ items, index, indexField }) => {
  truncateObject(index)
  items.reduce((newIdx, item) => {
    const indexValue = item[indexField]
    const list = newIdx[indexValue] || []
    list.push(item)
    newIdx[indexValue] = list
    return newIdx
  }, index)
}

/**
* Any "is this a valid add" checks are assumed to be performed by the caller.
*/
const addOneToOne = ({ item, index, indexField }) => {
  index[item[indexField]] = item
}

/**
* Any "is this a valid add" checks are assumed to be performed by the caller.
*/
const addOneToMany = ({ item, index, indexField }) => {
  const indexValue = item[indexField]
  const list = index[indexValue] || []
  list.push(item)
  index[indexValue] = list
}

/**
* Any "is this a valid update" checks are assumed to be performed by the caller.
*/
const updateOneToOne = ({ item, index, indexField, idIndex }) => {
  if (idIndex !== index) {
    // then we have to remove the original entry before adding the new entry
    const origItem = idIndex[item[indexField]]
    delete index[origItem[indexField]]
  }
  index[item[indexField]] = item
}

/**
* Any "is this a valid update" checks are assumed to be performed by the caller.
*/
const updateOneToMany = ({ item, keyField, index, indexField, idIndex }) => {
  const { origItem, origList, origListIndex } = getOrigData({ item, keyField, indexField, idIndex, index })
  if (origItem[indexField] === item[indexField]) {
    // then the key value of this index hasn't changed and we can simply replace
    origList.splice(origListIndex, 1, item)
  }
  else { // the key value has changed and we need to delete the original and re-add the new value
    origList.splice(origListIndex, 1)
    addOneToMany({ item, indexField, index })
  }
}

/**
* Any "is this a valid delete" checks are assumed to be performed by the caller. Currently, deletion just looks at the
* ID field and will happily delete an item from the index even if it is changed. Future versions will suport a
* 'requireClean' parameter.
*/
const deleteOneToOne = ({ item, indexField, index, idIndex }) => {
  const origItem = idIndex[item[indexField]]
  // the current item may have had the index value changed, so we delete based on the origItem
  delete index[origItem[indexField]]
}

/**
* Any "is this a valid delete" checks are assumed to be performed by the caller. Currently, deletion just looks at the
* ID field and will happily delete an item from the index even if it is changed. Future versions will suport a
* 'requireClean' parameter.
*/
const deleteOneToMany = ({ item, idIndex, index, indexField, keyField }) => {
  const { origList, origListIndex } = getOrigData({ item, idIndex, indexField, keyField, index })
  origList.splice(origListIndex, 1)
  if (origList.length === 0) {
    delete index[item[indexField]]
  }
}

/**
* Helper for update and delete 'one2many' functions.
*/
const getOrigData = ({ item, keyField, indexField, idIndex, index }) => {
  const origItem = idIndex[item[keyField]]

  const origIndexValue = origItem[indexField]
  const origList = index[origIndexValue]
  // We compare keys rather than objects as returned objects must be copied to preserve the integrity of the original
  // items along with the indexes.
  const origListIndex = origList.findIndex((i) => i[keyField] === origItem[keyField])

  return { origItem, origList, origListIndex }
}

export { ListManager }
