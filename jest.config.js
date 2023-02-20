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
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.po$': '<rootDir>/tests/PoTransformer.js',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'config': '<rootDir>/src/config/config.local.ts',
  },
  snapshotSerializers: [
    'jest-serializer-vue'
  ],
  testMatch: [
    '**/tests/unit/**/*.spec.(js|ts)|**/__tests__/*.(js|ts)'
  ],
  testURL: 'http://localhost/'
}
