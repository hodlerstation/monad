/** Chain-normalized evidence. Providers never approve missions or send rewards. */
export interface MissionTradeEvidence {
  chainId: number;
  contract: string;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  logIndex: number;
  account: string;
  tokenId: string;
  buy: boolean;
  quantity: string;
}
export const MISSION_EVENT_SOURCE = Symbol('MISSION_EVENT_SOURCE');
export interface MissionEventSource {
  /** RPC verification has already established finality and event contents. */
  indexed(evidence: MissionTradeEvidence): Promise<boolean>;
}
export class RpcMissionEventSource implements MissionEventSource {
  indexed(evidence: MissionTradeEvidence) {
    void evidence;
    return Promise.resolve(true);
  }
}
