const requiredResourceProperties = ['idNormalizer', 'itemClass', 'itemName', 'keyField', 'resourceName', 'validate']

const Model = class {
  #roots = []

  constructor({ resources } = {}) {
    for (const resource of resources) {
      this.bindResource(resource)
    }
  }

  bindResource(resource) {
    for (const property in requiredResourceProperties) {
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
  }

  validate() {
    for (const resource in this) {
      if (resource.validate) {
        resource.validate()
      }
    }
  }
}

export { Model }
