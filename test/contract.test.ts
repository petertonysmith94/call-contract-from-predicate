import { ASSET_A, ASSET_B, launchTestNode } from 'fuels/test-utils';
import { bn, buildFunctionResult, getContractCallOperations, WalletUnlocked } from 'fuels';

import { describe, test, expect } from 'vitest';

/**
 * Imports for the contract factory and bytecode, so that we can use them in the test.
 *
 * Can't find these imports? Make sure you've run `fuels build` to generate these with typegen.
 */
import { TestContract, TestContractFactory, TestPredicate } from '../src/sway-api';

/**
 * Contract Testing
 * 
 *
 * Tests for the contract program type within the TS SDK. Here we will test the deployment of
 * our contract, and the result of call it's functions.
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

    // Get the balance of the predicate
    // const { balances: [balanceA, balanceB] } = await predicate.getBalances();
    // expect(balanceA.assetId).toBe(assetA);
    // expect(balanceB.assetId).toBe(assetB);
    // expect(balanceA.amount.toNumber()).toBe(100);
    // expect(balanceB.amount.toNumber()).toBe(1000);

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
    const tx = await sender.sendTransaction(request);
    const result = await tx.waitForResult();
    expect(result.isStatusSuccess).toBe(true);

    // TODO: get the result of the function
    

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
