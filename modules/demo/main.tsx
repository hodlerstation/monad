import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { monad } from 'viem/chains';
import { toHex, verifyMessage } from 'viem';
import DynamicWalletProvider from '../dynamic-wallet-provider';
import { createWalletProvider } from '../wallet-provider';
import { verifyRecordedEvidence } from './verify';
import './style.css';

const bridge = createWalletProvider();
const networks = [{ chainId: 143, networkId: 143, name: monad.name,
  rpcUrls: [...monad.rpcUrls.default.http], blockExplorerUrls: [monad.blockExplorers.default.url],
  nativeCurrency: monad.nativeCurrency, iconUrls: [] }];
function App() {
  const [environment, setEnvironment] = useState('');
  const [active, setActive] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('Choose an action. No transactions are sent.');
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setResult('Checking…');
    try { setResult(JSON.stringify(await action(), null, 2)); }
    catch (error) { setResult('Not verified: ' + (error instanceof Error ? error.message : String(error))); }
    finally { setBusy(false); }
  }
  const wallet = <section><h2>Dynamic external wallet</h2>
    <p>Connect-only mode. This does not log in to HodlerStation or authorize a reward.</p>
    <button disabled={busy} onClick={() => run(() => bridge.provider.request({ method: 'eth_requestAccounts' }))}>Connect wallet</button>
    <button disabled={busy} onClick={() => run(async () => {
      await bridge.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x8f' }] });
      return { chainId: await bridge.provider.request({ method: 'eth_chainId' }) };
    })}>Switch to Monad</button>
    <button disabled={busy} onClick={() => run(async () => {
      const accounts = await bridge.provider.request({ method: 'eth_accounts' }) as string[];
      if (!accounts[0]) throw new Error('Connect a wallet first');
      const address = accounts[0] as `0x${string}`;
      const message = `HodlerStation public verification demo\nOrigin: ${location.origin}\nNonce: ${crypto.randomUUID()}\nNo login, transaction, or reward authorization.`;
      const signature = await bridge.provider.request({ method: 'personal_sign', params: [toHex(message), address] }) as `0x${string}`;
      const current = await bridge.provider.request({ method: 'eth_accounts' }) as string[];
      if (current[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet changed during verification');
      if (!await verifyMessage({ address, message, signature })) throw new Error('Invalid signature');
      return { wallet: address, signatureVerified: true, message, signature };
    })}>Sign verification message</button>
  </section>;
  return <main><h1>HodlerStation × Monad</h1><p>Public integration verification demo</p>
    <section><h2>1. Configure Dynamic</h2><p>Use your own Dynamic environment ID with localhost:5173 allowed. The ID is public configuration. Never enter a private key or API token.</p>
      <form onSubmit={event => { event.preventDefault(); setActive(environment.trim()); }}>
        <label>Dynamic environment ID <input required pattern="[0-9a-fA-F-]{36}" value={environment} onChange={event => setEnvironment(event.target.value)} disabled={!!active} /></label>
        <button disabled={!!active}>Start Dynamic</button>
      </form>
      {active && <button onClick={() => { bridge.cancel(); setActive(''); setResult('Dynamic session reset. Configure an environment to retry.'); }}>Reset demo connection</button>}
      {active && <DynamicWalletProvider environmentId={active} evmNetworks={networks} walletProviderBridge={bridge} userId="public-demo-session">{wallet}</DynamicWalletProvider>}
    </section>
    <section><h2>2. Replay recorded mainnet evidence</h2><p>Reads the recorded participant’s CHOG purchase, requires an exact Envio record, and checks the historical 0.0001 MON payment. This is not a new mission participation or Claim; it is independent of your connected wallet.</p>
      <button disabled={busy} onClick={() => run(verifyRecordedEvidence)}>Verify RPC + Envio + recorded payment</button>
    </section><section aria-live="polite"><h2>Result</h2><pre>{result}</pre></section>
    <p>The private service’s authentication, mission creation, eligibility and accounting are not reproduced here.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
