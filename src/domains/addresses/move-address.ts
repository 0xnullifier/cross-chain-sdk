
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { AddressLike, HexString } from './types'
import { PublicKey } from '@mysten/sui/cryptography';
import { fromBase64, fromHex, toHex } from '@mysten/sui/utils';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { AddressComplement } from './address-complement';
import { EvmAddress } from './evm-address';
import { UINT_160_MAX } from '@1inch/fusion-sdk';

export enum PublicKeyEnum {
    Ed25519 = 0,
    Secp256k1 = 1,
    Token = 2 // This is used for token addresses in Sui
}

export class SuiAddress implements AddressLike {
    private readonly buf: Uint8Array
    private readonly publickKeyType: PublicKeyEnum

    constructor(value: string, token?: boolean) {
        if (token) {
            this.buf = new Uint8Array([...Buffer.from(value, 'utf8')]);
            this.publickKeyType = PublicKeyEnum.Token;
            return;
        }

        this.buf = value.startsWith('0x') ? fromHex(value) : fromBase64(value);
        if (this.buf.length === Ed25519PublicKey.SIZE) {
            this.publickKeyType = PublicKeyEnum.Ed25519
        } else if (this.buf.length === Secp256k1PublicKey.SIZE) {
            this.publickKeyType = PublicKeyEnum.Secp256k1
        } else {
            throw new Error(`${value} is not a valid Sui address.`)
        }
    }

    toPublicKey(): PublicKey {
        if (this.publickKeyType === PublicKeyEnum.Ed25519) {
            return new Ed25519PublicKey(this.buf);
        } else if (this.publickKeyType === PublicKeyEnum.Secp256k1) {
            return new Secp256k1PublicKey(this.buf);
        }
        throw new Error(`Invalid public key type: ${this.publickKeyType}`);
    }

    static fromString(str: string, tok: boolean, complement?: string): SuiAddress {
        let addrStr = str;
        if (complement) {
        }
        return new SuiAddress(str, tok);
    }

    /**
     * @see splitToParts
     */
    static fromParts(parts: [AddressComplement, EvmAddress]): SuiAddress {
        const highBits = parts[0].inner
        const lowBits = parts[1].toBigint()
        const address = (highBits << 160n) | lowBits

        return SuiAddress.fromBigInt(address)
    }

    static fromBigInt(value: bigint): SuiAddress {
        const hex = value.toString(16);
        return SuiAddress.fromString(`0x${hex}`, false);
    }

    nativeAsZero(): AddressLike {
        return this;
    }

    zeroAsNative(): AddressLike {
        return this;
    }

    toBuffer(): Buffer {
        return Buffer.from(this.buf);
    }

    toBigint(): bigint {
        if (this.publickKeyType === PublicKeyEnum.Token) {
            throw new Error('Cannot convert token address to bigint');
        }
        return BigInt('0x' + toHex(this.buf));
    }

    toHex(): HexString {
        if (this.publickKeyType === PublicKeyEnum.Token) {
            const string = String.fromCharCode(...this.buf);
            return string as HexString;
        }
        return `0x${toHex(this.buf)}`
    }
    toString(): string {
        if (this.publickKeyType === PublicKeyEnum.Token) {
            return String.fromCharCode(...this.buf);
        }
        return toHex(this.buf);
    }
    splitToParts(): [AddressComplement, EvmAddress] {
        if (this.publickKeyType === PublicKeyEnum.Token) {
            throw new Error('Cannot split token address');
        }
        const bn = this.toBigint()

        return [
            new AddressComplement(bn >> 160n),
            EvmAddress.fromBigInt(bn & UINT_160_MAX)
        ]
    }

    equal(other: AddressLike): boolean {
        if (!(other instanceof SuiAddress)) {
            return false;
        }
        if (this.publickKeyType !== other.publickKeyType) {
            return false; // Different public key types
        }
        if (this.publickKeyType === PublicKeyEnum.Ed25519) {
            const thisKey = new Ed25519PublicKey(this.buf);
            const otherKey = new Ed25519PublicKey(other.toBuffer());
            return thisKey.equals(otherKey);
        } else if (this.publickKeyType === PublicKeyEnum.Secp256k1) {
            const thisKey = new Secp256k1PublicKey(this.buf);
            const otherKey = new Secp256k1PublicKey(other.toBuffer());
            return thisKey.equals(otherKey);
        }
        throw new Error(`Invalid operation`);
    }

    isNative(): boolean {
        if (this.publickKeyType === PublicKeyEnum.Token) {
            const string = String.fromCharCode(...this.buf)
            return string === "0x2::sui::SUI"
        }
        return false;
    }

    isZero(): boolean {
        return this.buf.every(byte => byte === 0); // Check if all bytes are zero
    }
}