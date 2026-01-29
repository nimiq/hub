// Declare types for individual files of bitcoinjs-lib to allow importing just parts of it instead of the entire lib.

declare module 'bitcoinjs-lib/src/address' {
    export * from 'bitcoinjs-lib/types/address';
}

declare module 'bitcoinjs-lib/src/script' {
    export * from 'bitcoinjs-lib/types/script';
}

declare module 'bitcoinjs-lib/src/networks' {
    export * from 'bitcoinjs-lib/types/networks';
}

declare module 'bitcoinjs-lib/src/payments' {
    export * from 'bitcoinjs-lib/types/payments';
}

declare module 'bitcoinjs-lib/src/transaction' {
    export * from 'bitcoinjs-lib/types/transaction';
}
