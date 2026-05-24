import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRetriableFrontendLoginError,
  withFrontendLoginRetry
} from '../lib/login-tool-adapter.mjs';

test('isRetriableFrontendLoginError matches 20105 and retry phrases', () => {
  assert.equal(isRetriableFrontendLoginError(new Error('verify-login 业务失败 code=20105 msg=操作失败，请重试')), true);
  assert.equal(isRetriableFrontendLoginError(new Error('Operation failed. Try again.')), true);
  assert.equal(isRetriableFrontendLoginError(new Error('other failure')), false);
});

test('withFrontendLoginRetry retries transient login errors until success', async () => {
  let attempts = 0;
  const delays = [];
  const result = await withFrontendLoginRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('verify-login 业务失败 code=20105 msg=操作失败，请重试');
    return { ok: true, attempts };
  }, {
    retries: 4,
    sleep: async ms => { delays.push(ms); }
  });
  assert.deepEqual(result, { ok: true, attempts: 3 });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1500, 3000]);
});

test('withFrontendLoginRetry does not retry non-transient errors', async () => {
  let attempts = 0;
  await assert.rejects(
    withFrontendLoginRetry(async () => {
      attempts += 1;
      throw new Error('bad credentials');
    }, {
      retries: 4,
      sleep: async () => {}
    }),
    /bad credentials/
  );
  assert.equal(attempts, 1);
});
