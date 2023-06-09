const requiredResourceProperties = ['itemClass', 'itemName', 'keyField', 'resourceName']
const requiredValidatorProperties = ['validate']

const Model = class {
  #rootResources = []
  #validators = []

  constructor({ resourceRoots = []} = {}) {
    for (const resource of resourceRoots) {
      this.bindRootResource(resource)
    }
  }

  bindRootResource(resource) {
    for (const property of requiredResourceProperties) {
      if (!(property in resource)) {
        throw new Error(`Resource ${resource.resourceName ? resource.resourceName + ' ' : ''} does not define required property '${property}'.`)
      }
    }

    Object.defineProperty(this, resource.resourceName, {
      value        : resource,
      writable     : false,
      enumerable   : true,
      configurable : false
    })

    this.#rootResources.push(resource)
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
    for (const resource of this.#rootResources) {
      if (resource.validate) {
        resource.validate()
      }
    }

    for (const validator of this.#validators) {
      validator.validate(this)
    }
  }
}

export { Model }
