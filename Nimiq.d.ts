declare namespace Nimiq {
    class Class {}
    class LogNative {}
    class Log {}

    class Observable {
        on(type: string, callback: Function): number
        off(type: string, id: number): void
        fire(type: string, ...args: any[]): (Promise<any>|null)
    }

    class DataChannel {}
    class CryptoLib {}
    class WebRtcFactory {}
    class WebSocketFactory {}
    class DnsUtils {}
    class ConstantHelper {}
    class Services {}
    class Timers {}
    class Version {}
    class Time {}
    class IteratorUtils {}
    class ArrayUtils {}
    class HashMap {}
    class HashSet {}
    class LimitHashSet {}
    class InclusionHashSet {}
    class LimitInclusionHashSet {}
    class LimitIterable {}
    class LinkedList {}
    class UniqueLinkedList {}
    class Queue {}
    class UniqueQueue {}
    class ThrottledQueue {}
    class SortedList {}
    class Assert {}

    class CryptoUtils {
        static encryptOtpKdf(data: Uint8Array, key: Uint8Array): Promise<Uint8Array>
        static decryptOtpKdf(data: Uint8Array, key: Uint8Array): Promise<Uint8Array>
    }

    class BufferUtils {
        static fromAscii(buf: string): Uint8Array
        static fromBase64(buf: string): Uint8Array
        static fromHex(buf: string): Uint8Array
        static toHex(buf: Uint8Array): string
        static equals(buf1: Uint8Array, buf2: Uint8Array): boolean
    }

    class SerialBuffer extends Uint8Array {
        constructor(bufferOrArrayOrLength: any)
        subarray(start: number, end: number): Uint8Array
        readPos: number
        writePos: number
        reset(): void
        read(length: number): Uint8Array
        write(array: any): void
        readUint8(): number
        writeUint8(value: number): void
        readUint16(): number
        writeUint16(value: number): void
        readUint32(): number
        writeUint32(value: number): void
        readUint64(): number
        writeUint64(value: number): void
        readVarInt(): number
        writeVarInt(value: number): void
        static varUintSize(value: number): number
        readFloat64(): number
        writeFloat64(value: number): void
        readString(length: number): string
        writeString(value: string, length: number): void
        readPaddedString(length: number): string
        writePaddedString(value: string, length: number): void
        readVarLengthString(): string
        writeVarLengthString(value: string): void
        static varLengthStringSize(value: string): number
    }

    class Synchronizer {}
    class MultiSynchronizer {}
    class PrioritySynchronizer {}
    class RateLimit {}
    class IWorker {}

    class WasmHelper {
        static doImportBrowser: () => void
    }

    class CryptoWorker {
        static getInstanceAsync(): Promise<Worker>
    }
    class CryptoWorkerImpl {}
    class CRC32 {}
    class BigNumber {}
    class NumberUtils {}
    class MerkleTree {}
    class MerklePath {}
    class MerkleProof {}
    class PlatformUtils {}
    class StringUtils {}

    class Policy {
        static coinsToSatoshis(coins: number): number
        static satoshisToCoins(satoshis: number): number
        static supplyAfter(blockHeight: number): number
        static blockRewardAt(blockHeight: number): number
        static BLOCK_TIME: 60
        static BLOCK_SIZE_MAX: 1e5
        static BLOCK_TARGET_MAX: BigNumber
        static DIFFICULTY_BLOCK_WINDOW: 120
        static DIFFICULTY_MAX_ADJUSTMENT_FACTOR: 2
        static TRANSACTION_VALIDITY_WINDOW: 120
        static SATOSHIS_PER_COIN: 1e5
        static TOTAL_SUPPLY: 21e14
        static INITIAL_SUPPLY: 252000000000000
        static EMISSION_SPEED: number
        static EMISSION_TAIL_START: 48692960
        static EMISSION_TAIL_REWARD: 4000
        static NUM_BLOCKS_VERIFICATION: 250
    }

    class Serializable {
        equals(o: Serializable): boolean
        compare(o: Serializable): number
        hashCode(): string
        toString(): string
        toBase64(): string
        toHex(): string
    }

    class Hash extends Serializable {
        static blake2b(arr: Uint8Array): Hash
        static argon2d(arr: Uint8Array): Promise<Hash>
        static sha256(arr: Uint8Array): Hash
        static fromBase64(base64: string): Hash
        static fromHex(hex: string): Hash
        static isHash(o: any): boolean
        subarray(begin: number, end: number): Uint8Array
    }

    class Entropy extends Serializable {
        constructor(arg: Uint8Array)
        static generate(): Entropy
        toExtendedPrivateKey(password?: string, wordlist?: string[]): ExtendedPrivateKey
        toMnemonic(wordlist?: string[]): string[]
        static unserialize(buf: SerialBuffer): Entropy
        serialize(buf?: SerialBuffer): SerialBuffer
        overwrite(entropy: Entropy): void
        static SIZE: 32
    }

    class ExtendedPrivateKey extends Serializable {
        static generateMasterKey(seed: Uint8Array): ExtendedPrivateKey
        derive(index: number): ExtendedPrivateKey
        static isValidPath(path: string): boolean
        derivePath(path: string): ExtendedPrivateKey
        static derivePathFromSeed(path: string, seed: Uint8Array): ExtendedPrivateKey
        static unserialize(buf: SerialBuffer): ExtendedPrivateKey
        serialize(buf?: SerialBuffer): SerialBuffer
        privateKey: PrivateKey
        toAddress(): Address
        static CHAIN_CODE_SIZE: 32
    }

    class PrivateKey extends Serializable {
        constructor(arg: Uint8Array)
        static generate(): PrivateKey
        static unserialize(buf: SerialBuffer): PrivateKey
        serialize(buf?: SerialBuffer): SerialBuffer
        static SIZE: 32
    }

    class PublicKey extends Serializable {
        static derive(privateKey: PrivateKey): PublicKey
        serialize(): SerialBuffer
        toAddress(): Address
    }

    class KeyPair extends Serializable {
        publicKey: PublicKey
        privateKey: PrivateKey
        isLocked: boolean
        static unserialize(buffer: SerialBuffer): KeyPair
        static fromEncrypted(buffer: SerialBuffer, passphraseOrPin: Uint8Array): Promise<KeyPair>
        static derive(key: PrivateKey): KeyPair
        static generate(): KeyPair
        exportEncrypted(passphrase: string | Uint8Array, unlockKey?: Uint8Array): Promise<SerialBuffer>
        serialize(): SerialBuffer
        lock(key: string | Uint8Array): Promise<void>
        relock(): void
        unlock(key: string | Uint8Array): Promise<void>
        equals(o: any): boolean
    }

    class RandomSecret {}

    class Signature extends Serializable {
        static create(privateKey: PrivateKey, publicKey: PublicKey, data: Uint8Array): Signature
        static unserialize(buf: SerialBuffer): Signature
        serialize(): SerialBuffer
        verify(publicKey: PublicKey, data: Uint8Array): boolean
    }

    class Commitment {}
    class CommitmentPair {}
    class PartialSignature {}

    class MnemonicUtils {
        static entropyToMnemonic(entropy: string | ArrayBuffer | Uint8Array | Entropy, wordlist?: string[]): string[]
        static entropyToLegacyMnemonic(entropy: string | ArrayBuffer | Uint8Array | Entropy, wordlist?: string[]): string[]
        static mnemonicToEntropy(mnemonic: string | string[], wordlist?: string[]): string[]
        static legacyMnemonicToEntropy(mnemonic: string | string[], wordlist?: string[]): string[]
        static mnemonicToSeed(mnemonic: string | string[], password?: string): Uint8Array
        static mnemonicToExtendedPrivateKey(mnemonic: string | string[], password?: string): ExtendedPrivateKey
        static isCollidingChecksum(entropy: Entropy): boolean
        static getMnemonicType(mnemonic: string | string[], wordlist?: string[]): number

        static DEFAULT_WORDLIST: string[]
        static ENGLISH_WORDLIST: string[]

        static MNEMONIC_TYPE: {
            LEGACY: 0,
            BIP39: 1,
            UNKNOWN: 2
        }
    }

    class Address extends Serializable {
        static fromString(str: string): Address
        static fromBase64(base64: string): Address
        static fromHex(hex: string): Address
        toUserFriendlyAddress(): string
        static fromUserFriendlyAddress(str: string): Address
        equals(o: Address): boolean
        serialize(): SerialBuffer
    }

    class Account {
        balance: number
        type: number
        static Type: {
            BASIC: 0
            VESTING: 1
            HTLC: 2
        }
    }

    namespace Account {
        type Type = 0 | 1 | 2
    }

    class PrunedAccount {}
    class BasicAccount extends Account {}
    class Contract extends Account {}
    class HashedTimeLockedContract extends Contract {}
    class VestingContract extends Contract {}
    class AccountsTreeNode {}
    class AccountsTreeStore {}
    class SynchronousAccountsTreeStore {}
    class AccountsProof {}
    class AccountsTreeChunk {}
    class AccountsTree {}
    class SynchronousAccountsTree {}
    class PartialAccountsTree {}
    class Accounts {}
    class BlockHeader {}
    class BlockInterlink {}
    class BlockBody {}
    class BlockUtils {}
    class Subscription {}

    abstract class Transaction {
        sender: Address
        senderType: Account.Type
        recipient: Address
        recipientType: Account.Type
        value: number
        fee: number
        feePerByte: number
        networkId: number
        validityStartHeight: number
        flags: Transaction.Flag
        hasFlag(flag: number): boolean
        data: Uint8Array
        proof: Uint8Array
        static unserialize(buf: SerialBuffer): Transaction
        serializeContent(): SerialBuffer
        verify(): boolean
        serialize(buf?: SerialBuffer): SerialBuffer
        hash(): Hash
        getContractCreationAddress(): Address
        static Format: {
            BASIC: 0
            EXTENDED: 1
        }
        static Flag: {
            NONE: 1
            CONTRACT_CREATION: 0b1
        }
    }
    namespace Transaction {
        type Format = 0 | 1
        type Flag = 0 | 0b1
    }

    class SignatureProof {
        static verifyTransaction(transaction: Transaction): boolean
        static singleSig(publicKey: PublicKey, signature: Signature): SignatureProof
        static multiSig(signerKey: PublicKey, publicKeys: PublicKey[], signature: Signature): SignatureProof
        static unserialize(buf: Uint8Array): SignatureProof
        serialize(): SerialBuffer
        verify(address: Address | null, data: Uint8Array): boolean
        publicKey: PublicKey
        signature: Signature
    }

    class BasicTransaction extends Transaction {
        constructor(
            publicKey: PublicKey,
            recipient: Address,
            value: number,
            fee: number,
            validityStartHeight: number
        )
        senderPubKey: PublicKey
        signature: Signature
    }

    class ExtendedTransaction extends Transaction {
        constructor(
            sender: Address,
            senderType: Account.Type,
            recipient: Address,
            recipientType: Account.Type,
            value: number,
            fee: number,
            validityStartHeight: number,
            flags: Transaction.Flag,
            data: Uint8Array
        )
    }

    class TransactionsProof {}
    class TransactionCache {}
    class TransactionStoreEntry {}
    class TransactionStore {}
    class TransactionReceipt {}
    class Block {}
    class IBlockchain extends Observable {}
    class BaseChain extends IBlockchain {}
    class BlockChain {}
    class HeaderChain {}
    class ChainProof {}
    class ChainData {}
    class ChainDataStore {}
    class MempoolTransactionSet {}
    class Mempool extends Observable {}
    class InvRequestManager {}
    class BaseConsensusAgent extends Observable {}
    class BaseConsensus extends Observable {}
    class FullChain extends BaseChain {}
    class FullConsensusAgent extends BaseConsensusAgent {}
    class FullConsensus extends BaseConsensus {}
    class LightChain extends FullChain {}
    class LightConsensusAgent extends FullConsensusAgent {}
    class LightConsensus extends BaseConsensus {}
    class PartialLightChain extends LightChain {}
    class NanoChain extends BaseChain {}
    class NanoConsensusAgent extends BaseConsensusAgent {}
    class NanoConsensus extends BaseConsensus {}
    class NanoMempool extends Observable {}
    class ConsensusDB {}
    class Consensus {}
    class Protocol {}
    class Message {}
    class AddrMessage extends Message {}
    class BlockMessage extends Message {}
    class RawBlockMessage extends Message {}
    class GetAddrMessage extends Message {}
    class GetBlocksMessage extends Message {}
    class HeaderMessage extends Message {}
    class InventoryMessage extends Message {}
    class MempoolMessage extends Message {}
    class PingMessage extends Message {}
    class PongMessage extends Message {}
    class RejectMessage extends Message {}
    class SignalMessage extends Message {}
    class SubscribeMessage extends Message {}
    class TxMessage extends Message {}
    class VersionMessage extends Message {}
    class VerAckMessage extends Message {}
    class AccountsProofMessage extends Message {}
    class GetAccountsProofMessage extends Message {}
    class ChainProofMessage extends Message {}
    class GetChainProofMessage extends Message {}
    class AccountsTreeChunkMessage extends Message {}
    class GetAccountsTreeChunkMessage extends Message {}
    class TransactionsProofMessage extends Message {}
    class GetTransactionsProofMessage extends Message {}
    class GetTransactionReceiptsMessage extends Message {}
    class TransactionReceiptsMessage extends Message {}
    class GetBlockProofMessage extends Message {}
    class BlockProofMessage extends Message {}
    class GetHeadMessage extends Message {}
    class HeadMessage extends Message {}
    class MessageFactory {}
    class WebRtcConnector extends Observable {}
    class WebRtcDataChannel extends DataChannel {}
    class WebRtcUtils {}
    class WebSocketConnector extends Observable {}
    class WebSocketDataChannel extends DataChannel {}
    class NetAddress {}
    class PeerId extends Serializable {}
    class PeerAddress {}
    class PeerAddressState {}
    class PeerAddressBook extends Observable {}

    class GenesisConfig {
        static main(): void
        static test(): void
        static dev(): void
        static bounty(): void
        static NETWORK_ID: number
        static NETWORK_NAME: string
        static GENESIS_BLOCK: Block
        static GENESIS_HASH: Hash
        static GENESIS_ACCOUNTS: string
        static SEED_PEERS: PeerAddress[]
    }

    class CloseType {}
    class NetworkConnection {}
    class PeerChannel {}
    class NetworkAgent {}
    class PeerConnectionStatistics {}
    class PeerConnection {}
    class SignalProcessor {}
    class ConnectionPool {}
    class PeerScorer {}
    class NetworkConfig {}
    class Network {}
    class NetUtils {}
    class PeerKeyStore {}
    class Peer {}
    class Miner extends Observable {}
    class BasePoolMiner extends Miner {}
    class SmartPoolMiner extends BasePoolMiner {}
    class NanoPoolMiner extends BasePoolMiner {}
    class Wallet {}
    class MultiSigWallet extends Wallet {}
    class WalletStore {}
    class MinerWorker {}
    class MinerWorkerImpl {}
    class MinerWorkerPool {}
}
