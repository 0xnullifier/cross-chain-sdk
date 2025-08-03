import { Immutables, SuiAddress } from "../../domains";
import { SUI_PACKAGE_ID } from "../../deployments";
import { BasePackage } from "./base-package";
import { Signer } from "@mysten/sui/cryptography";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import assert from "assert";
import { bcs } from "@mysten/sui/bcs";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";

export class MoveVMDstEscrow extends BasePackage {
    public static DEFAULT = new MoveVMDstEscrow(SUI_PACKAGE_ID);

    public static readonly DST_ESCROW_MODULE_NAME = "escrow_dst";

    public static readonly CREATE_DST_ESCROW_FN_NAME = "create_dst_escrow";

    public static readonly RESOLVER_WITHDRAW_FN_NAME = "resolver_withdraw";

    public static readonly PUBLIC_WITHDRAW_FN_NAME = "public_withdraw";

    public static readonly CANCEL_FN_NAME = "cancel";


    constructor(packageId: string) {
        super(packageId);
    }
    public static encodeDstImmutablesComplement(
        dstImmutables: Immutables<SuiAddress>
    ): Uint8Array {
        const SuiDstImmutables = bcs.struct("SuiDstImmutables", {
            hashlock: bcs.vector(bcs.u8()),
            maker: bcs.Address,
            amount: bcs.u64(),
            timelock: bcs.u256(),
            safetyDeposit: bcs.u64()
        })
        return SuiDstImmutables.serialize({
            hashlock: dstImmutables.hashLock.toBuffer(),
            maker: dstImmutables.maker.toString(),
            amount: dstImmutables.amount,
            timelock: dstImmutables.timeLocks.build(),
            safetyDeposit: dstImmutables.safetyDeposit
        }).toBytes()
    }

    public async createDstEscrow(
        dstImmutables: Immutables<SuiAddress>,
        resolver: Signer,
        chain: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        assert(`0x${dstImmutables.taker.toString()}` === resolver.getPublicKey().toSuiAddress(), "Resolver must match dstImmutables taker's public key");
        const url = getFullnodeUrl(chain);

        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);
        const immutables = MoveVMDstEscrow.encodeDstImmutablesComplement(dstImmutables);
        tx.moveCall({
            target: `${this.packageId}::${MoveVMDstEscrow.DST_ESCROW_MODULE_NAME}::${MoveVMDstEscrow.CREATE_DST_ESCROW_FN_NAME}`,
            arguments: [
                coinWithBalance({ type: dstImmutables.token.toString(), balance: dstImmutables.amount }),
                coinWithBalance({ balance: dstImmutables.safetyDeposit }),
                tx.pure.vector("u8", immutables),
            ],
            typeArguments: [dstImmutables.token.toString()],
        })
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
            }
        });

        await client.waitForTransaction({
            digest: result.digest,
        });

        return result;
    }

    public async resolverWithdraw(
        secretBytes: Uint8Array,
        immutablesObjectId: string,
        escrowObjectId: string,
        resolver: Signer,
        coinType: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMDstEscrow.DST_ESCROW_MODULE_NAME}::${MoveVMDstEscrow.RESOLVER_WITHDRAW_FN_NAME}`,
            arguments: [
                tx.pure.vector("u8", secretBytes),
                tx.object(immutablesObjectId),
                tx.object(escrowObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [
                coinType
            ]
        })
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true
            }
        });

        await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });
        return result;
    }

    public async publicWithdraw(
        secretBytes: Uint8Array,
        immutablesObjectId: string,
        escrowObjectId: string,
        resolver: Signer,
        coinType: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toString());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMDstEscrow.DST_ESCROW_MODULE_NAME}::${MoveVMDstEscrow.PUBLIC_WITHDRAW_FN_NAME}`,
            arguments: [
                tx.pure.vector("u8", secretBytes),
                tx.object(immutablesObjectId),
                tx.object(escrowObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [
                coinType
            ]
        })

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
            }
        });

        await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });
        return result;
    }

    public async cancel(
        immutablesObjectId: string,
        escrowObjectId: string,
        resolver: Signer,
        coinType: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toString());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMDstEscrow.DST_ESCROW_MODULE_NAME}::${MoveVMDstEscrow.CANCEL_FN_NAME}`,
            arguments: [
                tx.object(immutablesObjectId),
                tx.object(escrowObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [
                coinType
            ]
        })

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });

        return result;
    }

}