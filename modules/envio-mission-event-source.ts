import type { MissionEventSource, MissionTradeEvidence } from './mission-event-source';

const fields = ['chainId', 'contract', 'transactionHash', 'blockHash', 'blockNumber', 'logIndex', 'account', 'tokenId', 'buy', 'quantity'] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hex = (value: unknown, length: number) => typeof value === 'string' && new RegExp('^0x[0-9a-fA-F]{' + length + '}$').test(value);
const uint = (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < (1n << 256n);
function validEvidence(value: unknown): value is MissionTradeEvidence {
  if (!record(value) || !fields.every(key => Object.hasOwn(value, key))) return false;
  return Number.isSafeInteger(value.chainId) && Number(value.chainId) > 0 &&
    Number.isSafeInteger(value.logIndex) && Number(value.logIndex) >= 0 &&
    hex(value.contract, 40) && hex(value.account, 40) &&
    hex(value.transactionHash, 64) && hex(value.blockHash, 64) &&
    uint(value.blockNumber) && uint(value.tokenId) && uint(value.quantity) &&
    value.quantity !== '0' && typeof value.buy === 'boolean';
}

export type EnvioErrorCode = 'ENVIO_INVALID_EVIDENCE' | 'ENVIO_UNSUPPORTED_SCOPE' | 'ENVIO_UNAUTHORIZED' | 'ENVIO_RATE_LIMITED' | 'ENVIO_UNAVAILABLE' | 'ENVIO_TIMEOUT' | 'ENVIO_INVALID_RESPONSE';
export class EnvioSourceError extends Error {
  constructor(readonly code: EnvioErrorCode, readonly status?: number) {
    super(code);
    this.name = 'EnvioSourceError';
  }
}

/** Envio confirms indexing only; canonical RPC verification remains mandatory. */
export class EnvioMissionEventSource implements MissionEventSource {
  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
    private readonly scope?: readonly { chainId: number; contract: string }[],
  ) {
    const url = new URL(endpoint);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))))
      throw new Error('ENVIO_ENDPOINT_INVALID');
  }
  async indexed(evidence: MissionTradeEvidence): Promise<boolean> {
    if (!validEvidence(evidence)) throw new EnvioSourceError('ENVIO_INVALID_EVIDENCE');
    if (this.scope && !this.scope.some(item => item.chainId === evidence.chainId && item.contract.toLowerCase() === evidence.contract.toLowerCase()))
      throw new EnvioSourceError('ENVIO_UNSUPPORTED_SCOPE');
    const id = evidence.chainId + '_' + evidence.transactionHash.toLowerCase() + '_' + evidence.logIndex;
    // The same deadline covers response headers and body; never retry automatically during Claim.
    const signal = AbortSignal.timeout(5000);
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST', signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) },
        body: JSON.stringify({
          query: 'query MissionTrade($id: String!) { MissionTrade(where: {id: {_eq: $id}}, limit: 1) { chainId contract transactionHash blockHash blockNumber logIndex account tokenId buy quantity } }',
          variables: { id },
        }),
      });
    } catch {
      throw new EnvioSourceError(signal.aborted ? 'ENVIO_TIMEOUT' : 'ENVIO_UNAVAILABLE');
    }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'ENVIO_UNAUTHORIZED' : response.status === 429 ? 'ENVIO_RATE_LIMITED' : 'ENVIO_UNAVAILABLE';
      throw new EnvioSourceError(code, response.status);
    }
    let result: unknown;
    try { result = await response.json(); }
    catch { throw new EnvioSourceError(signal.aborted ? 'ENVIO_TIMEOUT' : 'ENVIO_INVALID_RESPONSE'); }
    if (!record(result) || (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length > 0)) || !record(result.data) || !Array.isArray(result.data.MissionTrade) || result.data.MissionTrade.length > 1)
      throw new EnvioSourceError('ENVIO_INVALID_RESPONSE');
    const row = result.data.MissionTrade[0];
    if (row === undefined) return false;
    // Malformed or mismatched rows never approve evidence.
    if (!validEvidence(row)) return false;
    return fields.every(key => {
      const value = evidence[key], actual = row[key];
      return typeof value === 'string' ? typeof actual === 'string' && actual.toLowerCase() === value.toLowerCase() : actual === value;
    });
  }
}
