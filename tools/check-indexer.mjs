import fs from 'node:fs/promises';
// Read-only readiness + exact event check. Never prints credentials or raw server errors.
const evidence = JSON.parse(
  await fs.readFile(
    new URL('../submission/evidence.json', import.meta.url),
    'utf8',
  ),
).indexer.event;
const endpoint = process.argv[2];
if (!endpoint || new URL(endpoint).protocol !== 'https:')
  throw new Error('Pass an HTTPS GraphQL endpoint');
const signal = AbortSignal.timeout(15000);
try {
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: {
      'content-type': 'application/json',
      ...(process.env.ENVIO_GRAPHQL_API_KEY
        ? { Authorization: 'Bearer ' + process.env.ENVIO_GRAPHQL_API_KEY }
        : {}),
    },
    body: JSON.stringify({
      query:
        'query Check($id:String!){MissionTrade(where:{id:{_eq:$id}},limit:1){id chainId contract transactionHash blockHash blockNumber logIndex account tokenId buy quantity} _meta{chainId isReady progressBlock sourceBlock}}',
      variables: { id: evidence.id },
    }),
  });
  if (!response.ok) throw new Error('HTTP_' + response.status);
  const body = await response.json();
  if (
    !body ||
    body.errors ||
    !Array.isArray(body.data?._meta) ||
    !Array.isArray(body.data?.MissionTrade)
  )
    throw new Error('INVALID_RESPONSE');
  const row = body.data.MissionTrade[0];
  const eventMatches =
    !!row &&
    Object.entries(evidence).every(([key, value]) => row[key] === value);
  const state = body.data._meta.find((x) => x.chainId === evidence.chainId);
  const ready = state?.isReady === true;
  const lag =
    state &&
    Number.isSafeInteger(state.sourceBlock) &&
    Number.isSafeInteger(state.progressBlock)
      ? state.sourceBlock - state.progressBlock
      : null;
  console.log(JSON.stringify({ ready, lagBlocks: lag, eventMatches }, null, 2));
  if (!ready || !eventMatches || lag === null || lag < 0) process.exitCode = 1;
} catch (error) {
  const message = String(error?.message);
  console.error(
    signal.aborted
      ? 'TIMEOUT'
      : /^(HTTP_[0-9]{3}|INVALID_RESPONSE)$/.test(message)
        ? message
        : 'QUERY_FAILED',
  );
  process.exitCode = 1;
}
