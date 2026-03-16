## MentoRouter

A UniswapRouter-style Router for the Mento AMM.
Deployed to mainnet at 0xBE729350F8CdFC19DB6866e8579841188eE57f67. See on [CeloScan](https://celoscan.io/address/0xBE729350F8CdFC19DB6866e8579841188eE57f67).

The contract is verified on CeloScan and the ABI can be extracted from there.

### How does it work?

The router's aim is to execute a series of chained swaps on pairs in the Mento AMM.
As an example we can look at the path USDC->cUSD->cKES. But this can be anything as long as two adjecent assets represent a tradable pair in the Broker.

This path has two swaps or steps: USDC->cUSD and cUSD->cKES.
In order to specificy a path the MentoRouter defines the following struct (as seen in [IMentoRouter.sol](./src/IMentoRouter.sol)):

```solidity
struct Step {
    address exchangeProvider;
    bytes32 exchangeId;
    address assetIn;
    address assetOut;
}
```

So for USDC->cUSD, the step is:

```solidity
IMentoRouter.Step memory USDC_to_cUSD = IMentoRouter.Step({
    exchangeProvider: 0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901,
    exchangeId: 0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7,
    assetIn: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C,
    assetOut: 0x765DE816845861e75A25fCA122bb6898B8B1282a
});
```

And for cUSD->cKES, the step is:

```solidity
IMentoRouter.Step memory cUSD_to_cKES = IMentoRouter.Step({
    exchangeProvider: 0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901,
    exchangeId: 0x89de88b8eb790de26f4649f543cb6893d93635c728ac857f0926e842fb0d298b,
    assetIn: 0x765DE816845861e75A25fCA122bb6898B8B1282a,
    assetOut: 0x456a3D042C0DbD3db53D5489e98dFb038553B0d0
});
```

The parameters to a step are consistent to the parameters needed to call the Mento Broker.

This lets us build a path:

```solidity
IMentoRouter.Step[] memory path = new IMentoRouter.Step[](2);
path[0] = USDC_to_cUSD;
path[1] = cUSD_to_cKES;
```

Now that we have a path thare two ways we can execute it:

- `swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Step[] path)` - which fixes the `amountIn` of input token, in our example USDC, and ensures at least `amountOutMin` of the output token, in our case cKES, is returned.
- `swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, Step[] path)` - which fixes the `amountOut` of output token, in our example cKES, and ensures at most `amountInMax` of the input token, in our case USDC, is spent.

In order to execute a swap you also need to give approval to the Router for the asset at the begining of the chain and the amount of either `amountIn` for (1) or `amountInMax` for (2).
Full Example:

```solidity
IMentoRouter.Step[] memory path = new IMentoRouter.Step[](2);
path[0] = IMentoRouter.Step({
    exchangeProvider: biPoolManager,
    exchangeId: cUSD_USDC_exchangeID,
    assetIn: USDC,
    assetOut: cUSD
});
path[1] = IMentoRouter.Step({
    exchangeProvider: bpm,
    exchangeId: cUSD_cKES_exchangeID,
    assetIn: cUSD,
    assetOut: cKES
});

IERC20(USDC).approve(address(mentoRouter), 1e3);
mentoRouter.swapExactTokensForTokens(1e3, 0, path);
```

You can see more examples in the [Swap Script](./script/Swap.s.sol) or the [Test](./test/MentoRouter.t.sol);

You can also estimate a path by calling one of the two functions:

- `getAmountOut(uint256 amountIn, Step[] path)` - which returns how much of the last asset in the chain you will get for a given amount of the first.
- `getAmountIn(uint256 amuntOut, Step[], path)` - which returns how much of the first asset in the chain is required to get a certain amount of the last asset in the chain.

These functions should be used in conjuction with the `amountInMax` and `amountOutMin` variables of the swap functions in order to control slippage.

#### Example run

This [transaction](https://celoscan.io/tx/0x105057c33b90dcc3da37609e56bd0d1295d4a29016ec8c6f3da058eb192d7fbe) is a test swap for a 4 step path USDC->cUSD->axlUSDC->EURC.
As seen in the token transfers it results in these swaps:

- 0.000978 USDC for 0.000977775065868 cUSD
- 0.000977775065868 cUSD for 0.000977 axlUSDC
- 0.000977 axlUSDC for 0.000898586312316351 cEUR
- 0.000898586312316351 cEUR for 0.0009 EURC

The net token transfers are 000978 USDC for 0.0009 EURC
