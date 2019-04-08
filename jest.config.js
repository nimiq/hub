module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'node',
    'ts',
    'vue'
  ],
  transform: {
    '^.+\\.vue$': 'vue-jest',
    '.+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$': 'jest-transform-stub',
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'config': '<rootDir>/config.local.ts',
    '@nimiq/iqons/dist/iqons-name.min.js': '@nimiq/iqons/dist/iqons-name.cjs.js',
  },
  snapshotSerializers: [
    'jest-serializer-vue'
  ],
  testMatch: [
    '**/tests/unit/**/*.spec.(js|ts)|**/__tests__/*.(js|ts)'
  ],
  testURL: 'http://localhost/'
}
