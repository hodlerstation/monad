import type {
  MissionEventSource,
  MissionTradeEvidence,
} from './mission-event-source';

/** Envio only confirms indexing; canonical RPC evidence remains mandatory. */
export class EnvioMissionEventSource implements MissionEventSource {
  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
  ) {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      throw new Error('ENVIO_ENDPOINT_INVALID');
  }
  async indexed(evidence: MissionTradeEvidence): Promise<boolean> {
    const id = `${evidence.chainId}_${evidence.transactionHash.toLowerCase()}_${evidence.logIndex}`;
    const response = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        query: `query MissionTrade($id: String!) { MissionTrade(where: {id: {_eq: $id}}, limit: 1) { chainId contract transactionHash blockHash blockNumber logIndex account tokenId buy quantity } }`,
        variables: { id },
      }),
    });
    if (!response.ok) throw new Error('ENVIO_UNAVAILABLE');
    const result = (await response.json()) as {
      errors?: unknown[];
      data?: { MissionTrade?: Partial<MissionTradeEvidence>[] };
    };
    if (result.errors?.length || !Array.isArray(result.data?.MissionTrade))
      throw new Error('ENVIO_INVALID_RESPONSE');
    const row = result.data.MissionTrade[0];
    if (!row) return false;
    return Object.entries(evidence).every(([key, value]) => {
      const actual = row[key as keyof MissionTradeEvidence];
      return typeof value === 'string'
        ? typeof actual === 'string' &&
            actual.toLowerCase() === value.toLowerCase()
        : actual === value;
    });
  }
}
