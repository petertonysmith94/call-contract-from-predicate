import { ASSET_A, ASSET_B, launchTestNode } from 'fuels/test-utils';
import { BN, bn, buildFunctionResult } from 'fuels';

import { describe, test, expect } from 'vitest';

import { TestContract, TestContractFactory, TestPredicate } from '../src/sway-api';
import { AssetIdOutput } from '../src/sway-api/contracts/TestContract';

/**
 * Contract Testing
 */
describe('Contract', () => {
  test('should transfer two assets to contract', async () => {
    using launched = await launchTestNode({
      contractsConfigs: [
        {
          factory: TestContractFactory,
        },
      ],
    });
    const { provider, contracts: [contract], wallets: [funder, sender] } = launched;

    // Fund the predicate
    const assetA = ASSET_A;
    const assetB = ASSET_B;
    const predicatePin = 1337;
    const predicate = new TestPredicate({ provider, data: [predicatePin] });
    await funder.transfer(predicate.address, 100, assetA);
    await funder.transfer(predicate.address, 1000, assetB);

    // Assert the balance of the predicate
    const { balances: [predicateBalanceA, predicateBalanceB] } = await predicate.getBalances();
    expect(predicateBalanceA.assetId).toBe(assetA);
    expect(predicateBalanceB.assetId).toBe(assetB);
    expect(predicateBalanceA.amount.toNumber()).toBe(100);
    expect(predicateBalanceB.amount.toNumber()).toBe(1000);

    // Contract the contract call request
    const contractFromPredicate = new TestContract(contract.id, predicate);
    const fn = contractFromPredicate.multiCall([
      contractFromPredicate.functions.deposit().callParams({
        forward: { assetId: assetA, amount: bn(100) },
      }),
      contractFromPredicate.functions.deposit().callParams({
        forward: { assetId: assetB, amount: bn(1000) },
      }),
    ]);
    const request = await fn.getTransactionRequest();

    // Add the predicate resources to the request
    const resourcesToForward = await predicate.getResourcesToSpend([
      { assetId: assetA, amount: bn(100) },
      { assetId: assetB, amount: bn(1000) },
    ]);
    request.addResources(resourcesToForward);

    // Fund the transaction
    const costs = await sender.getTransactionCost(request);
    request.gasLimit = costs.gasUsed;
    request.maxFee = costs.maxFee;
    await sender.fund(request, costs);

    // Send the transaction
    const response = await sender.sendTransaction(request);
    const result = await response.waitForResult();
    expect(result.isStatusSuccess).toBe(true);

    // Get the result of the function calls
    const fnResult = await buildFunctionResult<[AssetIdOutput, BN][]>(
      {
        funcScope: [
          contractFromPredicate.functions.deposit(),
          contractFromPredicate.functions.deposit(),
      ],
      isMultiCall: true,
      program: contract,
      transactionResponse: response,
    })
    const { value: [valueA, valueB] } = fnResult;
    const [resultAssetA, resultAssetAmount] = valueA;

    // Check the result of the first function call
    expect(resultAssetA).toEqual({ bits: assetA });
    expect(resultAssetAmount.toNumber()).toBe(100);

    // Check the result of the second function call
    const [resultAssetB, resultAssetAmountB] = valueB;
    expect(resultAssetB).toEqual({ bits: assetB });
    expect(resultAssetAmountB.toNumber()).toBe(1000);

    // Get the balance of the contract
    const balanceA = await contract.getBalance(ASSET_A);
    const balanceB = await contract.getBalance(ASSET_B);
    expect(balanceA.toNumber()).toEqual(100);
    expect(balanceB.toNumber()).toEqual(1000);

    // Get the balance of the predicate
    const { balances } = await predicate.getBalances();
    expect(balances.length).toEqual(0);
  })
});
