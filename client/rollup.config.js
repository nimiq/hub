// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';

export default [
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/AccountsManagerClient.umd.js',
            format: 'umd',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/AccountsManagerClient.es.js',
            format: 'es',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/standalone/AccountsManagerClient.umd.js',
            format: 'umd',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve() ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/standalone/AccountsManagerClient.es.js',
            format: 'es',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve() ]
    }
];
