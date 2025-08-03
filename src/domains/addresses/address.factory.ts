import { EvmAddress } from './evm-address'
import { SolanaAddress } from './solana-address'
import { AddressComplement } from './address-complement'
import { isEvm, isSui, SupportedChain } from '../../chains'
import { AddressForChain } from '../../type-utils'
import { SuiAddress } from './move-address'

export function createAddress<Chain extends SupportedChain>(
    // hex/base58
    address: string,
    chainId: Chain,
    complement?: AddressComplement,
    tok?: boolean
): AddressForChain<Chain> {
    if (isEvm(chainId)) {
        return EvmAddress.fromUnknown(address) as AddressForChain<Chain>
    }

    if (isSui(chainId)) {
        if (complement) {
            return SuiAddress.fromParts([
                complement,
                EvmAddress.fromUnknown(address)
            ]) as AddressForChain<Chain>
        }

        let token = false
        if (tok) {
            token = true
        }
        return SuiAddress.fromString(address, token) as AddressForChain<Chain>
    }

    if (complement) {
        const evm = EvmAddress.fromUnknown(address)

        return SolanaAddress.fromParts([
            complement,
            evm
        ]) as AddressForChain<Chain>
    }

    return SolanaAddress.fromUnknown(address) as AddressForChain<Chain>
}
