import { isSupportedChain, NetworkEnum, SupportedChain } from "../../chains"
import { BaseOrder } from "../base-order"
import { ResolverCancellationConfig } from "../svm"
import { AuctionDetails, AuctionPoint, EvmAddress, HashLock, SuiAddress, TimeLocks } from "../../domains"
import { MoveDetails, MoveEscrowParams, MoveExtra, OnChainOrderData, OrderHashParams } from "./types"
import { assertUInteger, bufferFromHex } from "../../utils"
import assert from "assert"
import { BitMask, UINT_32_MAX, UINT_64_MAX } from "@1inch/byte-utils"
import { AuctionCalculator, randBigInt, UINT_256_MAX } from "@1inch/fusion-sdk"
import { injectTrackCode } from "../source-track"
import { bcs } from "@mysten/sui/bcs"
import { keccak256 } from "ethers"
import { toHex } from "@mysten/sui/utils"

export type MoveVmOrderJSON = {
    orderInfo: {
        srcToken: string // a string as `0x<packageid>::<module>::<type>` for MoveVM
        dstToken: string // a evm address
        maker: string // a solana address
        receiver: string // a evm address
        srcAmount: string // a u64 bigint
        minDstAmount: string // a u256 bigint
    }
    escrowParams: {
        hashlock: string // 32 bytes hex string
        srcChainId: NetworkEnum.SUI,
        dstChainId: number, // EVM chain id
        srcSafetyDeposit: string // a u64 bigint
        dstSafetyDeposit: string // a u64 bigint
        timeLocks: string // u256 bigint
    },
    details: {
        auction: {
            startTime: string // a u64 bigint
            duration: string // a u64 bigint
            initialRateBump: number // a u64 bigint
            points: AuctionPoint[]
        }
    }
    extra: {
        srcAssetIsNative: boolean // true if src asset is native
        orderExpirationDelay: string // bigint
        resolverCancellationConfig: {
            maxCancellationPremium: string // bigint
            cancellationAuctionDuration: number // bigint   
        }
        source: string // 'sdk' or 'relayer'
        allowMultipleFills: boolean // true if multiple fills are allowed
        salt: string // a bigint
    }
}

export type OrderInfoData = {
    srcToken: SuiAddress // a string as `0x<packageid>::<module>::<type>` for MoveVM
    dstToken: EvmAddress // a evm address
    maker: SuiAddress
    srcAmount: bigint // a u64 bigint
    minDstAmount: bigint // a u256 bigint
    receiver: EvmAddress // a evm address
}

export class MoveVmCrossChainOrder extends BaseOrder<
    SuiAddress,
    MoveVmOrderJSON,
    EvmAddress
> {
    private static TRACK_CODE_MASK = new BitMask(32n, 64n)
    private static DefaultExtra = {
        orderExpirationDelay: 12n,
        allowMultipleFills: true,
        source: 'sdk',
        resolverCancellationConfig: ResolverCancellationConfig.ALMOST_ZERO // to enable cancellation by resolver
    }

    private readonly orderConfig: {
        srcToken: SuiAddress
        dstToken: EvmAddress
        maker: SuiAddress
        receiver: EvmAddress
        srcAmount: bigint // a u64 bigint
        minDstAmount: bigint // a u256 bigint
        deadline: number // u32
        salt: bigint // a bigint

        srcAssetIsNative: boolean // true if src asset is native
        resolverCancellationConfig: ResolverCancellationConfig
        allowMultipleFills: boolean // true if multiple fills are allowed
        orderExpirationDelay: bigint // bigint
        source: string // 'sdk' or 'relayer'
    }

    private readonly details: MoveDetails

    public readonly escrowParams: MoveEscrowParams

    private constructor(
        orderInfo: OrderInfoData,
        escrowParams: MoveEscrowParams,
        details: MoveDetails,
        extra: MoveExtra
    ) {
        assert(
            isSupportedChain(escrowParams.srcChainId),
            `Not supported chain ${escrowParams.srcChainId}`
        )
        assert(
            isSupportedChain(escrowParams.dstChainId),
            `Not supported chain ${escrowParams.dstChainId}`
        )
        assert(
            escrowParams.srcChainId !== escrowParams.dstChainId,
            'Chains must be different'
        )

        super()
        const orderExpirationDelay =
            extra.orderExpirationDelay ??
            MoveVmCrossChainOrder.DefaultExtra.orderExpirationDelay
        assertUInteger(orderExpirationDelay, UINT_64_MAX)


        const deadline =
            details.auction.startTime +
            details.auction.duration +
            orderExpirationDelay
        assertUInteger(deadline, UINT_64_MAX)
        assertUInteger(orderInfo.srcAmount, UINT_64_MAX)
        assertUInteger(orderInfo.minDstAmount, UINT_256_MAX)

        const resolverCancellationConfig =
            extra.resolverCancellationConfig ||
            MoveVmCrossChainOrder.DefaultExtra.resolverCancellationConfig
        const source = extra.source ?? MoveVmCrossChainOrder.DefaultExtra.source
        const isSaltContainsSource = extra.salt && extra.salt > UINT_32_MAX

        const salt = isSaltContainsSource
            ? extra.salt!
            : injectTrackCode(
                extra.salt ?? randBigInt(UINT_32_MAX),
                source,
                MoveVmCrossChainOrder.TRACK_CODE_MASK
            )

        this.details = details
        this.escrowParams = escrowParams
        this.orderConfig = {
            ...orderInfo,
            source,
            salt,
            allowMultipleFills:
                extra.allowMultipleFills ??
                MoveVmCrossChainOrder.DefaultExtra.allowMultipleFills,
            srcAssetIsNative: extra.srcAssetIsNative || false,
            deadline: Number(deadline),
            resolverCancellationConfig: resolverCancellationConfig,
            orderExpirationDelay
        }

    }

    public get auction(): AuctionDetails {
        return this.details.auction
    }

    public get salt(): bigint {
        return this.orderConfig.salt
    }

    public get resolverCancellationConfig(): ResolverCancellationConfig {
        return this.orderConfig.resolverCancellationConfig
    }

    public get hashLock(): HashLock {
        return this.escrowParams.hashLock
    }

    public get timeLocks(): TimeLocks {
        return this.escrowParams.timeLocks
    }

    public get srcSafetyDeposit(): bigint {
        return this.escrowParams.srcSafetyDeposit
    }

    public get dstSafetyDeposit(): bigint {
        return this.escrowParams.dstSafetyDeposit
    }

    public get dstChainId(): SupportedChain {
        return this.escrowParams.dstChainId
    }

    public get maker(): SuiAddress {
        return this.orderConfig.maker
    }

    public get makerAsset(): SuiAddress {
        return this.orderConfig.srcToken
    }

    public get takerAsset(): EvmAddress {
        return this.orderConfig.dstToken
    }

    public get makingAmount(): bigint {
        return this.orderConfig.srcAmount
    }

    public get takingAmount(): bigint {
        return this.orderConfig.minDstAmount
    }
    public get receiver(): EvmAddress {
        return this.orderConfig.receiver
    }

    public get deadline(): bigint {
        return BigInt(this.orderConfig.deadline)
    }

    public get auctionStartTime(): bigint {
        return this.details.auction.startTime
    }

    public get auctionEndTime(): bigint {
        return this.auctionStartTime + this.details.auction.duration
    }

    public get partialFillAllowed(): boolean {
        return this.orderConfig.allowMultipleFills
    }

    public get multipleFillsAllowed(): boolean {
        return this.orderConfig.allowMultipleFills
    }

    public get srcAssetIsNative(): boolean {
        return this.orderConfig.srcAssetIsNative
    }

    get source(): string {
        return this.orderConfig.source
    }
    static new(
        orderInfo: OrderInfoData,
        escrowParams: MoveEscrowParams,
        details: MoveDetails,
        extra: Omit<MoveExtra, 'srcAssetIsNative'>
    ): MoveVmCrossChainOrder {
        return new MoveVmCrossChainOrder(
            {
                ...orderInfo,
            },
            escrowParams,
            details,
            {
                ...extra,
                srcAssetIsNative: orderInfo.srcToken.isNative()
            }
        )
    }


    static fromContractOrder(
        data: OnChainOrderData,
        auction: AuctionDetails,
    ): MoveVmCrossChainOrder {
        const detials: MoveDetails = { auction }
        const extraDetails: MoveExtra = {
            ...data.extra,
            orderExpirationDelay: this.calcExpirationDelay(
                data.expirationTime,
                auction.startTime,
                auction.duration
            )
        }
        return new MoveVmCrossChainOrder(
            data.orderInfo,
            data.escrowParams,
            detials,
            extraDetails
        )
    }

    static fromJSON(data: MoveVmOrderJSON): MoveVmCrossChainOrder {
        return new MoveVmCrossChainOrder(
            {
                srcToken: SuiAddress.fromString(data.orderInfo.srcToken, true),
                dstToken: EvmAddress.fromString(data.orderInfo.dstToken),
                maker: SuiAddress.fromString(data.orderInfo.maker, false),
                receiver: EvmAddress.fromString(data.orderInfo.receiver),
                srcAmount: BigInt(data.orderInfo.srcAmount),
                minDstAmount: BigInt(data.orderInfo.minDstAmount),
            },
            {
                hashLock: HashLock.fromString(data.escrowParams.hashlock),
                srcChainId: data.escrowParams.srcChainId,
                dstChainId: data.escrowParams.dstChainId,
                srcSafetyDeposit: BigInt(data.escrowParams.srcSafetyDeposit),
                dstSafetyDeposit: BigInt(data.escrowParams.dstSafetyDeposit),
                timeLocks: TimeLocks.fromBigInt(BigInt(data.escrowParams.timeLocks))
            },
            {
                auction: AuctionDetails.fromJSON({ ...data.details.auction, gasCost: { gasBumpEstimate: '0', gasPriceEstimate: '0' } })
            },
            {
                srcAssetIsNative: data.extra.srcAssetIsNative,
                orderExpirationDelay: BigInt(data.extra.orderExpirationDelay),
                resolverCancellationConfig: new ResolverCancellationConfig(
                    BigInt(
                        data.extra.resolverCancellationConfig
                            .maxCancellationPremium
                    ),
                    data.extra.resolverCancellationConfig.cancellationAuctionDuration
                ),
                source: data.extra.source,
                allowMultipleFills: data.extra.allowMultipleFills,
                salt: BigInt(data.extra.salt)
            }
        )
    }


    static getOrderHashBuffer(params: OrderHashParams): Buffer {
        const ExtraData = bcs.struct("ExtraData", {
            hashlock: bcs.vector(bcs.u8()),
            dstChainId: bcs.u256(),
            dstAddress: bcs.bytes(32),
            timeLock: bcs.u256(),
            deposits: bcs.u256()
        })
        const safetyDeposit = params.srcSafetyDeposit << 128n
        const deposits = safetyDeposit + params.dstSafetyDeposit
        const extraDataBytes = ExtraData.serialize({
            hashlock: params.hashLock.toBuffer(),
            dstChainId: params.dstChainId,
            dstAddress: params.receiver.toBuffer(),
            timeLock: params.timeLocks.build(),
            deposits
        })
        return bufferFromHex(
            keccak256(
                Buffer.concat([
                    bcs.u64().serialize(params.makingAmount).toBytes(),
                    bcs.bytes(32).serialize(params.maker.toBuffer()).toBytes(),
                    bcs.u256().serialize(params.takingAmount).toBytes(),
                    extraDataBytes.toBytes(),
                ])
            )
        )
    }


    public toJSON(): MoveVmOrderJSON {
        const auction = this.auction.toJSON()

        return {
            details: {
                // skip gasCost field
                auction: {
                    duration: auction.duration,
                    initialRateBump: auction.initialRateBump,
                    points: auction.points,
                    startTime: auction.startTime
                }
            },
            orderInfo: {
                srcToken: this.orderConfig.srcToken.toString(),
                dstToken: this.orderConfig.dstToken.toString(),
                maker: this.orderConfig.maker.toString(),
                srcAmount: this.orderConfig.srcAmount.toString(),
                minDstAmount: this.orderConfig.minDstAmount.toString(),
                receiver: this.orderConfig.receiver.toString()
            },
            escrowParams: {
                hashlock: this.hashLock.toString(),
                srcChainId: NetworkEnum.SUI,
                dstChainId: this.dstChainId,
                srcSafetyDeposit: this.escrowParams.srcSafetyDeposit.toString(),
                dstSafetyDeposit: this.escrowParams.dstSafetyDeposit.toString(),
                timeLocks: this.timeLocks.build().toString()
            },
            extra: {
                srcAssetIsNative: this.srcAssetIsNative,
                orderExpirationDelay:
                    this.orderConfig.orderExpirationDelay.toString(),
                resolverCancellationConfig:
                    this.resolverCancellationConfig.toJSON(),
                source: this.orderConfig.source,
                allowMultipleFills: this.multipleFillsAllowed,
                // use only last bits because high ones set from source
                salt: (this.salt & UINT_32_MAX).toString()
            }
        }
    }

    /**
 * @returns order has in base58 encoding
 */
    public getOrderHash(_srcChainId: number): string {
        return toHex(this.getOrderHashBuffer())
    }

    public getOrderHashBuffer(): Buffer {
        return MoveVmCrossChainOrder.getOrderHashBuffer(this)
    }

    public getCalculator(): AuctionCalculator {
        const details = this.details.auction

        return new AuctionCalculator(
            details.startTime,
            details.duration,
            details.initialRateBump,
            details.points,
            0n // no taker fee
        )
    }

}