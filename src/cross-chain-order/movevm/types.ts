import { ResolverCancellationConfig } from '../svm'
import { AuctionDetails } from '../../domains/auction-details'
import { HashLock } from '../../domains/hash-lock'
import { TimeLocks } from '../../domains/time-locks'
import { MoveVmChain, NetworkEnum, SupportedChain } from '../../chains'
import { FixedLengthArray } from '../../type-utils'
import { MoveVmCrossChainOrder, OrderInfoData } from './mvm-cross-chain-order'

// extradata
export type MoveEscrowParams = {
    hashLock: HashLock
    srcChainId: NetworkEnum
    dstChainId: SupportedChain
    srcSafetyDeposit: bigint
    dstSafetyDeposit: bigint
    timeLocks: TimeLocks
}

export type MoveDetails = {
    auction: AuctionDetails
}

export type OnChainOrderData = {
    orderInfo: OrderInfoData,
    escrowParams: MoveEscrowParams
    extra: Omit<Required<MoveExtra>, 'orderExpirationDelay' | 'source'>
    expirationTime: bigint
}

export type MoveExtra = {
    srcAssetIsNative?: boolean
    /**
     * Order will expire in `orderExpirationDelay` after auction ends
     * Default 12s
     */
    orderExpirationDelay?: bigint
    resolverCancellationConfig?: ResolverCancellationConfig
    /**
     * Can be omitted for salt > UINT_32_MAX
     */
    source?: string
    allowMultipleFills?: boolean
    // random value in interval [0, UINT_32_MAX]
    // If salt > UINT_32_MAX, then source won't be injected to it
    salt?: bigint
}

export type CreateOrderData = {
    hashlock: FixedLengthArray<number, 32>,
    amount: bigint,
    safetyDeposit: bigint,
    timelocks: bigint,
    expirationTime: number,
    dstAmount: bigint,
    ductionAuctionData: Uint8Array,
    salt: bigint,
    dstChainParams: {
        chainId: number,
        makerAddress: string,
        token: string,
        safetyDeposit: bigint
    }
}


export type OrderHashParams = Pick<
    MoveVmCrossChainOrder,
    | 'hashLock'
    | 'maker'
    | 'makerAsset'
    | 'makingAmount'
    | 'srcSafetyDeposit'
    | 'timeLocks'
    | 'deadline'
    | 'srcAssetIsNative'
    | 'takingAmount'
    | 'dstChainId'
    | 'receiver'
    | 'dstSafetyDeposit'
> &
    (
        | {
            auction: AuctionDetails
        }
        | {
            auctionHash: Buffer
        }
    )

