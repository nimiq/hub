// TODO [USDT-CASHLINK]: This file contains MOCK implementations for UI development
// Replace all functions with actual Polygon/OpenGSN/Keyguard integration when backend is ready

import { SignedPolygonTransaction } from '../../../client/PublicRequestTypes';

/**
 * Mock interface for a Polygon account with USDT balance
 */
export interface MockPolygonAccount {
    address: string;
    usdtBalance: number; // in USDT cents (6 decimals)
    label?: string;
}

/**
 * Mock keyguard signing function for USDT cashlink creation
 *
 * TODO [USDT-CASHLINK]: Replace with actual keyguard integration
 * Expected: Call KeyguardClient.signUsdtCashlink(request)
 * Expected input: OpenGSN ForwardRequest with:
 *   - from: sender address
 *   - to: USDT cashlink contract address
 *   - data: encoded function call (transfer USDT)
 *   - gas, nonce, validUntil
 * Expected return: SignedPolygonTransaction { message, signature }
 */
export async function mockSignUsdtCashlink(request: {
    keyId: string,
    keyPath: string,
    keyLabel: string,
    senderLabel?: string,
    cashlinkMessage?: string,
    amount: number,
    fee: number,
    recipient: string,
}): Promise<SignedPolygonTransaction> {
    console.log('[MOCK] Signing USDT cashlink creation:', request);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock signed transaction result
    // Convert string to hex without using Node.js Buffer
    const mockData = 'mock-transfer-data';
    const hexData = '0x' + Array.from(mockData)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');

    return {
        message: {
            from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Mock sender
            to: request.recipient,
            value: '0',
            gas: '100000',
            nonce: String(Math.floor(Math.random() * 1000)),
            data: hexData,
            validUntil: String(Math.floor(Date.now() / 1000) + 3600),
        },
        signature: '0x' + Array.from({ length: 130 }, () =>
            Math.floor(Math.random() * 16).toString(16)).join(''),
    };
}

/**
 * Mock function to get Polygon accounts with USDT balances
 *
 * TODO [USDT-CASHLINK]: Replace with actual account fetching
 * Should query wallet store for accounts with polygonAddresses
 * Should fetch USDT balance from Polygon network via ethers.js
 */
export function getMockPolygonAccounts(): MockPolygonAccount[] {
    console.log('[MOCK] Getting Polygon accounts with USDT balances');

    // Return mock accounts
    return [
        {
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            usdtBalance: 100000000, // 100.00 USDT
            label: 'Main Account',
        },
        {
            address: '0x1234567890123456789012345678901234567890',
            usdtBalance: 50000000, // 50.00 USDT
            label: 'Secondary Account',
        },
    ];
}

/**
 * Mock function to relay a USDT transaction to the Polygon network
 *
 * TODO [USDT-CASHLINK]: Replace with actual OpenGSN relay
 * Should:
 * 1. Send signed transaction to OpenGSN relay
 * 2. Relay submits to Polygon network
 * 3. Return transaction hash
 */
export async function mockRelayUsdtTransaction(signedTx: SignedPolygonTransaction): Promise<string> {
    console.log('[MOCK] Relaying USDT transaction to network:', signedTx);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Mock: randomly fail 10% of the time to test error handling
    if (Math.random() < 0.1) {
        throw new Error('Mock relay error: Network congestion');
    }

    // Return mock transaction hash
    return '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Mock function to check USDT balance of an address
 *
 * TODO [USDT-CASHLINK]: Replace with actual balance check
 * Should query USDT token contract on Polygon:
 *   const contract = new ethers.Contract(USDT_TOKEN_ADDRESS, ABI, provider);
 *   const balance = await contract.balanceOf(address);
 */
export async function mockGetUsdtBalance(address: string): Promise<number> {
    console.log('[MOCK] Getting USDT balance for:', address);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return mock balance
    return 100000000; // 100.00 USDT
}

/**
 * Mock function to get current Polygon gas price
 *
 * TODO [USDT-CASHLINK]: Replace with actual gas price fetching
 * Should query Polygon network for current gas price
 */
export async function mockGetGasPrice(): Promise<string> {
    console.log('[MOCK] Getting Polygon gas price');

    // Return mock gas price (in wei)
    return '30000000000'; // 30 gwei
}

/**
 * Mock function to estimate USDT transaction fee
 *
 * TODO [USDT-CASHLINK]: Replace with actual fee estimation
 * Should calculate OpenGSN relay fee based on:
 * - Gas price
 * - Gas limit
 * - Relay fee percentage
 * - Base relay fee
 */
export async function mockEstimateUsdtFee(): Promise<number> {
    console.log('[MOCK] Estimating USDT transaction fee');

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return mock fee (in USDT cents)
    return 500000; // ~0.50 USDT
}

/**
 * Mock function to check if address has enough USDT for cashlink + fee
 */
export async function mockCheckSufficientBalance(
    address: string,
    amount: number,
    fee: number,
): Promise<boolean> {
    const balance = await mockGetUsdtBalance(address);
    return balance >= (amount + fee);
}

/**
 * Mock network status for UI state management
 */
export enum MockNetworkStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    SYNCING = 'syncing',
    READY = 'ready',
    ERROR = 'error',
}

/**
 * Mock function to get current network status
 */
export function mockGetNetworkStatus(): MockNetworkStatus {
    // For UI development, always return READY after component mount
    return MockNetworkStatus.READY;
}
