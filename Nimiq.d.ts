// todo put this in own npm package

declare namespace Nimiq {
    class Class {}
    class LogNative {}
    class Log {}

    class Observable {
        public on(type: string, callback: (...args: any[]) => any): number;
        public off(type: string, id: number): void;
        public fire(type: string, ...args: any[]): (Promise<any>|null);
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

    class BufferUtils {
        public static fromAscii(buf: string): Uint8Array;
        public static fromHex(buf: string): Uint8Array;
        public static toHex(buf: Uint8Array): string;
        public static equals(buf1: Uint8Array, buf2: Uint8Array): boolean;
    }

    class SerialBuffer extends Uint8Array {
        public static varUintSize(value: number): number;
        public static varLengthStringSize(value: string): number;
        public readPos: number;
        public writePos: number;
        constructor(bufferOrArrayOrLength: any)
        public subarray(start: number, end: number): SerialBuffer;
        public reset(): void;
        public read(length: number): Uint8Array;
        public write(array: any): void;
        public readUint8(): number;
        public writeUint8(value: number): void;
        public readUint16(): number;
        public writeUint16(value: number): void;
        public readUint32(): number;
        public writeUint32(value: number): void;
        public readUint64(): number;
        public writeUint64(value: number): void;
        public readVarInt(): number;
        public writeVarInt(value: number): void;
        public readFloat64(): number;
        public writeFloat64(value: number): void;
        public readString(length: number): string;
        public writeString(value: string, length: number): void;
        public readPaddedString(length: number): string;
        public writePaddedString(value: string, length: number): void;
        public readVarLengthString(): string;
        public writeVarLengthString(value: string): void;
    }

    class Synchronizer {}
    class MultiSynchronizer {}
    class PrioritySynchronizer {}
    class RateLimit {}
    class IWorker {}

    class WasmHelper {
        public static doImportBrowser: () => void;
    }

    class CryptoWorker {}
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
        public static BLOCK_TIME: 60;
        public static BLOCK_SIZE_MAX: 1e5;
        public static BLOCK_TARGET_MAX: BigNumber;
        public static DIFFICULTY_BLOCK_WINDOW: 120;
        public static DIFFICULTY_MAX_ADJUSTMENT_FACTOR: 2;
        public static TRANSACTION_VALIDITY_WINDOW: 120;
        public static SATOSHIS_PER_COIN: 1e5;
        public static TOTAL_SUPPLY: 21e14;
        public static INITIAL_SUPPLY: 252000000000000;
        public static EMISSION_SPEED: number;
        public static EMISSION_TAIL_START: 48692960;
        public static EMISSION_TAIL_REWARD: 4000;
        public static NUM_BLOCKS_VERIFICATION: 250;
        public static coinsToSatoshis(coins: number): number;
        public static satoshisToCoins(satoshis: number): number;
        public static supplyAfter(blockHeight: number): number;
        public static blockRewardAt(blockHeight: number): number;
    }

    class Serializable {
        public equals(o: Serializable): boolean;
        public compare(o: Serializable): number;
        public hashCode(): string;
        public toString(): string;
        public toBase64(): string;
        public toHex(): string;
    }

    class Hash extends Serializable {
        public static blake2b(arr: Uint8Array): Hash;
        public static argon2d(arr: Uint8Array): Promise<Hash>;
        public static sha256(arr: Uint8Array): Hash;
        public static fromBase64(base64: string): Hash;
        public static fromHex(hex: string): Hash;
        public static isHash(o: any): boolean;
    }

    class PrivateKey extends Serializable {
        public static SIZE: 32;
        public static generate(): PrivateKey;
        public static unserialize(buf: SerialBuffer): PrivateKey;
        public serialize(): SerialBuffer;
    }

    class PublicKey extends Serializable {
        public serialize(): SerialBuffer;
        public toAddress(): Address;
    }

    class KeyPair extends Serializable {
        public static unserialize(buffer: SerialBuffer): KeyPair;
        public static fromEncrypted(buffer: SerialBuffer, passphraseOrPin: Uint8Array): Promise<KeyPair>;
        public static derive(key: PrivateKey): KeyPair;
        public static generate(): KeyPair;
        public publicKey: PublicKey;
        public privateKey: PrivateKey;
        public isLocked: boolean;
        public exportEncrypted(passphrase: string | Uint8Array, unlockKey?: Uint8Array): Promise<SerialBuffer>;
        public serialize(): SerialBuffer;
        public lock(key: string | Uint8Array): Promise<void>;
        public relock(): void;
        public unlock(key: string | Uint8Array): Promise<void>;
        public equals(o: any): boolean;
    }

    class RandomSecret {}

    class Signature extends Serializable {
        public static create(privateKey: PrivateKey, publicKey: PublicKey, data: Uint8Array): Signature;
        public static unserialize(buf: SerialBuffer): Signature;
        public serialize(): SerialBuffer;
        public verify(publicKey: PublicKey, data: Uint8Array): boolean;
    }

    class Commitment {}
    class CommitmentPair {}
    class PartialSignature {}

    class Address extends Serializable {
        public static fromString(str: string): Address;
        public static fromBase64(base64: string): Address;
        public static fromHex(hex: string): Address;
        public static fromUserFriendlyAddress(str: string): Address;
        public toUserFriendlyAddress(): string;
        public equals(o: Address): boolean;
    }

    class Account {
        public static Type: {
            BASIC: 0,
            VESTING: 1,
            HTLC: 2,
        };
        public balance: number;
        public type: number;
    }

    namespace Account {
        type Type = 0 | 1 | 2;
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
        public static Format: {
            BASIC: 0,
            EXTENDED: 1,
        };
        public static Flag: {
            NONE: 1,
            CONTRACT_CREATION: 0b1,
        };
        public static unserialize(buf: SerialBuffer): Transaction;
        public sender: Address;
        public senderType: number;
        public recipient: Address;
        public recipientType: number;
        public value: number;
        public fee: number;
        public feePerByte: number;
        public networkId: number;
        public validityStartHeight: number;
        public flags: number;
        public data: Uint8Array;
        public proof: Uint8Array;
        public hasFlag(flag: number): boolean;
        public serializeContent(): SerialBuffer;
        public verify(): boolean;
        public serialize(buf?: SerialBuffer): SerialBuffer;
        public hash(): Hash;
        public getContractCreationAddress(): Address;
    }
    namespace Transaction {
        type Format = 0 | 1;
        type Flag = 0 | 0b1;
    }

    class SignatureProof {
        public static verifyTransaction(transaction: Transaction): boolean;
        public static singleSig(publicKey: PublicKey, signature: Signature): SignatureProof;
        public static multiSig(signerKey: PublicKey, publicKeys: PublicKey[], signature: Signature): SignatureProof;
        public static unserialize(buf: Uint8Array): SignatureProof;
        public publicKey: PublicKey;
        public signature: Signature;
        public serialize(): SerialBuffer;
        public verify(address: Address | null, data: Uint8Array): boolean;
    }

    class BasicTransaction extends Transaction {
        public senderPubKey: PublicKey;
        public signature: Signature;
        constructor(
            publicKey: PublicKey,
            recipient: Address,
            value: number,
            fee: number,
            validityStartHeight: number,
        )
    }

    class ExtendedTransaction extends Transaction {
        constructor(
            sender: Address,
            senderType: number,
            recipient: Address,
            recipientType: number,
            value: number,
            fee: number,
            validityStartHeight: number,
            flags: number,
            data: Uint8Array,
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
        public static NETWORK_ID: number;
        public static NETWORK_NAME: string;
        public static GENESIS_BLOCK: Block;
        public static GENESIS_HASH: Hash;
        public static GENESIS_ACCOUNTS: string;
        public static SEED_PEERS: PeerAddress[];
        public static main(): void;
        public static test(): void;
        public static dev(): void;
        public static bounty(): void;
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

export default Nimiq;
