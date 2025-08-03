HODLER=0x4a18a50a8328b42773268B4b436254056b7d70CE
WETH=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
MAKER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
MAKER_PRIV=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ONE_INCH_LIMIT_ORDER=0x111111125421ca6dc452d289314280a0f8842a65
ACCESS_TOKEN=0xacce550000159e70908c0499a1119d04e7039c28


RPC_URL=https://virtual.mainnet.eu.rpc.tenderly.co/702101b0-dd4e-4666-b035-a44ec54ea1e9
DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# DEPLOY_OUTPUT=$(forge create contracts/src/TestEscrowFactory.sol:TestSettlement --rpc-url  $RPC_URL  --private-key $DEPLOYER_PRIVATE_KEY --broadcast --constructor-args $ONE_INCH_LIMIT_ORDER $WETH $ACCESS_TOKEN $DEPLOYER 100000 100000)
FACTORY_ADDRESS=0x733697D06E9AbC1C45d1a1c75D18910d43133a6F
echo "Deployed contract address: $FACTORY_ADDRESS"


# RESOLVER_DEPLOY_OUTPUT=$(forge create contracts/src/Resolver.sol:Resolver --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast --constructor-args $FACTORY_ADDRESS $ONE_INCH_LIMIT_ORDER $DEPLOYER)
RESOLVER_ADDRESS=0xb53249FEBB6562Abf19BD728d6775c09d2ae0438
echo "Deployed resolver contract address: $RESOLVER_ADDRESS"


# Aprove limiit contract to spend WETH on behalf of the maker
# cast send  $WETH \
#    --rpc-url $RPC_URL \
#    --from $MAKER \
#    --private-key $MAKER_PRIV \
#    "approve(address,uint256)" \
#    $ONE_INCH_LIMIT_ORDER \
#    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
#    --unlocked \
#    --gas-limit 10000000

# Aprove limiit contract to spend WETH on behalf of the maker
cast send $USDC \
   --rpc-url $RPC_URL \
   --from $MAKER \
   --private-key $MAKER_PRIV \
   "approve(address,uint256)" \
   $ONE_INCH_LIMIT_ORDER \
   0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
   --unlocked \
   --gas-limit 10000000


# Aprove limiit contract to spend WETH on behalf of the maker
# cast send  $WETH \
#    --rpc-url $RPC_URL \
#    --from $MAKER \
#    --private-key $MAKER_PRIV \
#    "transfer(address,uint256)" \
#    $RESOLVER_ADDRESS \
#    300000000000000000000 \
#    --unlocked \
#    --gas-limit 10000000

# fund the resolver contract
# cast send --from $DEPLOYER --value 20ether $RESOLVER_ADDRESS --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC_URL --unlocked --gas-limit 10000000


# transfer WETH to the maker
# echo "cast rpc anvil_impersonateAccount $HODLER"
# echo "cast send $WETH \\"
# echo "    --from $HODLER \\"
# echo "    \"transfer(address,uint256)(bool)\" \\"
# echo "    $MAKER \\"
# echo "    300000000000000000000 \\"
# echo "    --unlocked \\"
# echo "    --gas-limit 10000000"
# echo ""
# echo "# transfer WETH to the resolver contract"
# echo "cast send $WETH \\"
# echo "   --from $HODLER \\"
# echo "   \"transfer(address,uint256)(bool)\" \\"
# echo "   $RESOLVER_ADDRESS \\"
# echo "   300000000000000000000 \\"
# echo "   --unlocked \\"
# echo "   --gas-limit 10000000"


# # IDK if we have to do this or not
# export ACCESS_TOKEN_MINTER=0x89c8eec57bd474816d407fe38354b8410b567da3
# export ACCESS_TOKEN=0xacce550000159e70908c0499a1119d04e7039c28


# cast rpc anvil_impersonateAccount $ACCESS_TOKEN_MINTER

# cast send $ACCESS_TOKEN \
#    --from $ACCESS_TOKEN_MINTER \
#    "mint(address,uint256)" \
#    0xD0725945859175dabd070855bC3F1c37a3aF605F \
#    102 \
#    --unlocked \
#    --gas-limit 10000000

