import { it, expect } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { parseTransaction, keccak256 } from 'viem';
import { signNativeTransfer, verifySignedTransfer } from '../native-transfer';
it('signs exact native units on Monad and rejects altered persisted bytes', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const raw = await signNativeTransfer(account, {
    chainId: 10143,
    nonce: 0,
    to: account.address,
    value: 1000000000000000001n,
    gas: 21000n,
    maxFeePerGas: 10n,
    maxPriorityFeePerGas: 1n,
  });
  expect(parseTransaction(raw).value).toBe(1000000000000000001n);
  expect(parseTransaction(raw).chainId).toBe(10143);
  expect(verifySignedTransfer(raw, keccak256(raw))).toBe(raw);
  expect(() => verifySignedTransfer(raw, '0x00')).toThrow(
    'MON_TRANSACTION_CHANGED',
  );
});
