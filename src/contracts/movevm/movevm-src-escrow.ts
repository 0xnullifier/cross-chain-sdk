import { Signer } from "@mysten/sui/cryptography";
import { SUI_PACKAGE_ID } from "../../deployments";
import { BasePackage } from "./base-package";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";

export class MoveVMSrcEscrowPackage extends BasePackage {
    public static DEFAULT = new MoveVMSrcEscrowPackage(SUI_PACKAGE_ID)

    public static readonly SRC_ESCROW_MODULE_NAME = "escrow_src";

    public static readonly WITHDRAW_TO_FN_NAME = "withdraw_to";

    public static readonly PUBLIC_WITHDRAW_TO_FN_NAME = "public_withdraw";

    public static readonly RESOLVER_CANCEL_FN_NAME = "resolver_cancel";

    public static readonly PUBLIC_CANCEL_FN_NAME = "public_cancel";

    constructor(
        packageId: string,
    ) {
        super(packageId);
    }

    public async withdrawTo(
        escrowObjectId: string,
        immutablesObjectId: string,
        asset: string,
        resolver: Signer,
        secret: Uint8Array,
        chain: "mainnet" | "testnet" | "devnet" = "testnet",
        recipient?: string,
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);

        const to = recipient ? tx.pure.address(recipient) : tx.pure.address(resolver.getPublicKey().toSuiAddress());

        const res = tx.moveCall({
            target: `${this.packageId}::${MoveVMSrcEscrowPackage.SRC_ESCROW_MODULE_NAME}::${MoveVMSrcEscrowPackage.WITHDRAW_TO_FN_NAME}`,
            arguments: [
                to,
                tx.pure.vector("u8", secret),
                tx.object(escrowObjectId),
                tx.object(immutablesObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [asset]

        })
        console.log(res)
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
        });
        return result;
    }

    public async publicWithdraw(
        escrowObjectId: string,
        immutablesObjectId: string,
        secret: Uint8Array,
        resolver: Signer,
        asset: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet",
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMSrcEscrowPackage.SRC_ESCROW_MODULE_NAME}::${MoveVMSrcEscrowPackage.PUBLIC_WITHDRAW_TO_FN_NAME}`,
            arguments: [
                tx.pure.vector("u8", secret),
                tx.object(escrowObjectId),
                tx.object(immutablesObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [asset]
        })

        let result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        result = await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });
        return result;
    }

    public async resolverCancel(
        immutablesObjectId: string,
        escrowObjectId: string,
        resolver: Signer,
        asset: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet",
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMSrcEscrowPackage.SRC_ESCROW_MODULE_NAME}::${MoveVMSrcEscrowPackage.RESOLVER_CANCEL_FN_NAME}`,
            arguments: [
                tx.object(immutablesObjectId),
                tx.object(escrowObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [
                asset
            ]
        })
        let result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        result = await client.waitForTransaction({
            digest: result.digest,
        });
        return result;
    }

    public async publicCancel(
        immutablesObjectId: string,
        escrowObjectId: string,
        resolver: Signer,
        asset: string,
        chain: "mainnet" | "testnet" | "devnet" = "testnet",
    ) {
        const url = getFullnodeUrl(chain);
        const client = new SuiClient({ url });
        const tx = new Transaction();
        tx.setSender(resolver.getPublicKey().toSuiAddress());
        tx.setGasBudget(100000000n);

        tx.moveCall({
            target: `${this.packageId}::${MoveVMSrcEscrowPackage.SRC_ESCROW_MODULE_NAME}::${MoveVMSrcEscrowPackage.PUBLIC_CANCEL_FN_NAME}`,
            arguments: [
                tx.object(immutablesObjectId),
                tx.object(escrowObjectId),
                tx.object(SUI_CLOCK_OBJECT_ID)
            ],
            typeArguments: [
                asset
            ]
        })

        let result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: resolver,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        result = await client.waitForTransaction({
            digest: result.digest,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });
        return result;
    }

}