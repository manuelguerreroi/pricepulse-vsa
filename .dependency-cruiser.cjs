/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-slice-imports',
      severity: 'error',
      comment: 'Vertical Slice Architecture violation: Slices cannot import other slices directly.',
      from: {
        path: '^src/features/([^/]+)/([^/]+)/',
      },
      to: {
        path: '^src/features/',
        pathNot: [
          // A slice can only import from its own subfolder or its subdomain module
          '^src/features/$1/$2/',
          '^src/features/$1/$1\\.module\\.ts$',
        ],
      },
    },
    {
      name: 'shared-cannot-import-features',
      severity: 'error',
      comment: 'Shared kernel cannot depend on features.',
      from: {
        path: '^src/shared/',
      },
      to: {
        path: '^src/features/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Warn about circular dependencies',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
