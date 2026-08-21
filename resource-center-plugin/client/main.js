(function loadDshResourceCenterModules(global) {
  const registry = global.__dshResourceCenterModuleRegistry || {}
  const moduleSpecs = {
    workspace: {
      registryKey: 'workspace',
      dependencies: [],
    },
    serviceManager: {
      registryKey: 'serviceManager',
      dependencies: ['workspace'],
    },
    test: {
      registryKey: 'test',
      dependencies: ['workspace'],
    },
    hunter: {
      registryKey: 'hunter',
      dependencies: ['workspace'],
    },
    usageStats: {
      registryKey: 'usageStats',
      dependencies: ['workspace'],
    },
    rightSidebar: {
      registryKey: 'rightSidebar',
      dependencies: ['workspace'],
    },
  }
  const requestedModules = Array.isArray(global.__DSH_RESOURCE_CENTER_MODULES)
    ? global.__DSH_RESOURCE_CENTER_MODULES
    : Object.keys(moduleSpecs)
  const loadedModules = global.__dshResourceCenterLoadedModules instanceof Set
    ? global.__dshResourceCenterLoadedModules
    : new Set()

  function loadModule(id) {
    if (loadedModules.has(id)) return
    const spec = moduleSpecs[id]
    if (!spec) {
      throw new Error(`dsh-resource-center: unknown client module "${id}"`)
    }
    for (const dependency of spec.dependencies) loadModule(dependency)
    const register = registry[spec.registryKey]
    if (typeof register !== 'function') {
      throw new Error(`dsh-resource-center: client module "${id}" is not registered`)
    }
    register(global)
    loadedModules.add(id)
  }

  for (const id of requestedModules) loadModule(id)
  global.__dshResourceCenterLoadedModules = loadedModules
})(typeof window === 'undefined' ? globalThis : window)
