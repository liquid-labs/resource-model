const requiredItemManagerProperties = ['itemClass', 'itemName', 'keyField', 'itemsName']
const requiredValidatorProperties = ['validate']

const Model = class {
  #rootItemManagers = []
  #subModels = []
  #validators = []

  constructor({ rootItemManagers = [], subModels = [], validators = [] } = {}) {
    for (const itemManager of rootItemManagers) {
      this.bindRootItemManager(itemManager)
    }
    for (const { name, model } of subModels) {
      this.bindSubModel(name, model)
    }
    for (const validator of validators) {
      this.bindValidator(validator)
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

  bindSubModel(name, model) {
    for (const property of requiredValidatorProperties) {
      if (!(property in model)) {
        throw new Error(`Sub-model ${name} does not define required property '${property}'.`)
      }
    }

    Object.defineProperty(this, name, {
      value        : model,
      writable     : false,
      enumerable   : true,
      configurable : false
    })

    this.#subModels.push(model)
  }

  bindValidator(validator) {
    for (const property of requiredValidatorProperties) {
      if (!(property in validator)) {
        throw new Error(`Validator ${validator.name ? validator.name + ' ' : ''} does not define required property '${property}'.`)
      }
    }

    this.#validators.push(validator)
  }

  async validate() {
    const validations = []

    for (const itemManager of this.#rootItemManagers) {
      if (itemManager.validate) {
        validations.push(itemManager.validate())
      }
    }

    for (const validator of this.#validators) {
      validations.push(validator.validate(this))
    }

    for (const subModel of this.#subModels) {
      validations.push(subModel.validate())
    }

    await Promise.all(validations)
  }
}

export { Model }
