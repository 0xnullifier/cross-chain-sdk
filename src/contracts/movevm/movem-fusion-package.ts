import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { MoveVmCrossChainOrder, MoveVmOrderJSON } from "../../cross-chain-order/movevm";
import { SUI_PACKAGE_ID } from "../../deployments";
import { BasePackage } from "./base-package";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Signer } from "@mysten/sui/cryptography";
import assert from "assert";

export class MoveVMFusionPackage extends BasePackage {
    static DEFAULT = new MoveVMFusionPackage(SUI_PACKAGE_ID)

    public static readonly FUSION_MODULE_NAME = "fusion_protocol"

    public static readonly CREATE_CROSS_CHAIN_ORDER_FN_NAME = "create_cross_chain_order";

    public static readonly FILL_CROSS_CHAIN_ORDER_FN_NAME = "fill_cross_chain_order";

    constructor(
        packageId: string,
    ) {
        super(packageId);
    }

    public async createCrossChainOrder(
        order: MoveVmCrossChainOrder,
        signer: Signer,
        chain: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        console.log(order.maker.toString())
        assert(signer.getPublicKey().toSuiAddress() === `0x${order.maker.toString()}`, "Signer must match order maker's public key");
        const url = getFullnodeUrl(chain)
        const client = new SuiClient({ url });
        const auctionData = order.auction.encodeBcs()
        const tx = new Transaction()
        const ExtraData = bcs.struct("ExtraData", {
            hashLock: bcs.vector(bcs.u8()),
            dstChainId: bcs.u256(),
            dstToken: bcs.bytes(32),
            timeLock: bcs.u256(),
            deposits: bcs.u256()
        })
        const deposits = order.srcSafetyDeposit << 128n | order.dstSafetyDeposit;
        // Ensure dstToken is exactly 32 bytes, pad with zeros if necessary
        let dstTokenBuffer = order.takerAsset.toBuffer();
        if (dstTokenBuffer.length < 32) {
            const padded = Buffer.alloc(32);
            dstTokenBuffer.copy(padded);
            dstTokenBuffer = padded;
        }

        const extraDataBytes = ExtraData.serialize({
            hashLock: order.hashLock.toBuffer(),
            dstChainId: order.dstChainId,
            dstToken: dstTokenBuffer,
            timeLock: order.timeLocks.build(),
            deposits
        }).toBytes()

        tx.setSender(signer.getPublicKey().toSuiAddress())
        tx.setGasBudget(10000000n)
        const coin = await client.getCoins({
            owner: signer.getPublicKey().toSuiAddress(),
            coinType: order.makerAsset.toString()
        });
        console.log(coin)
        console.log(order.makerAsset.isNative())
        const coinArg = tx.splitCoins(order.makerAsset.isNative() ? tx.gas : coin.data[0].coinObjectId, [tx.pure.u64(order.makingAmount)]);
        tx.moveCall({
            target: `${this.packageId}::${MoveVMFusionPackage.FUSION_MODULE_NAME}::${MoveVMFusionPackage.CREATE_CROSS_CHAIN_ORDER_FN_NAME}`,
            arguments: [
                coinArg,
                tx.pure.u256(order.takingAmount),
                tx.pure.vector("u8", auctionData),
                tx.pure.u64(order.deadline),
                tx.object(SUI_CLOCK_OBJECT_ID),
                tx.pure(bcs.option(bcs.Address).serialize(order.receiver.toString())),
                tx.pure.vector("u8", extraDataBytes)
            ],
            typeArguments: [
                coin.data[0].coinType
            ]
        })
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true
            }
        })
        console.log(result)
        const result2 = await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true
            }
        })
        return result2;
    }

    public async fillCrossChainOrder(
        orderObjectId: string,
        srcSafetyDeposit: bigint,
        fillingAmount: bigint,
        srcToken: string,
        resolver: Signer,
        network: "mainnet" | "testnet" | "devnet" = "testnet"
    ) {
        const url = getFullnodeUrl(network)
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);
        tx.moveCall({
            target: `${this.packageId}::${MoveVMFusionPackage.FUSION_MODULE_NAME}::${MoveVMFusionPackage.FILL_CROSS_CHAIN_ORDER_FN_NAME}`,
            arguments: [
                tx.object(orderObjectId),
                tx.pure.u64(fillingAmount),
                tx.object(SUI_CLOCK_OBJECT_ID),
                coinWithBalance({ balance: BigInt(srcSafetyDeposit) })
            ],
            typeArguments: [
                srcToken
            ]
        })
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true
            }
        });
        const res2 = await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true
            }
        });
        return res2;
    }

}