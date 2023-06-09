const requiredItemManagerProperties = ['itemClass', 'itemName', 'keyField', 'itemsName']
const requiredValidatorProperties = ['validate']

const Model = class {
  #rootItemManagers = []
  #validators = []

  constructor({ rootItemManagers = [] } = {}) {
    for (const itemManager of rootItemManagers) {
      this.bindRootItemManager(itemManager)
    }
  }

  bindRootItemManager(itemManager) {
    for (const property of requiredItemManagerProperties) {
      if (!(property in itemManager)) {
        throw new Error(`Item manager ${itemManager.itemsName ? `'${itemManager.itemsName}' ` : ''} does not define required property '${property}'.`)
      }
    }

    Object.defineProperty(this, itemManager.itemsName, {
      value        : itemManager,
      writable     : false,
      enumerable   : true,
      configurable : false
    })

    this.#rootItemManagers.push(itemManager)
  }

  bindValidator(validator) {
    for (const property of requiredValidatorProperties) {
      if (!(property in validator)) {
        throw new Error(`Validator ${validator.name ? validator.name + ' ' : ''} does not define required property '${property}'.`)
      }
    }

    this.#validators.push(validator)
  }

  validate() {
    for (const itemManager of this.#rootItemManagers) {
      if (itemManager.validate) {
        itemManager.validate()
      }
    }

    for (const validator of this.#validators) {
      validator.validate(this)
    }
  }
}

export { Model }
