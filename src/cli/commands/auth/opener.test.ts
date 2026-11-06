import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openerCommand } from './opener.ts';

void test('the opener gets the URL as one argument and no shell, per platform', () => {
  const url = 'http://127.0.0.1/x?a=1&b=2';
  assert.deepEqual(openerCommand('linux', url), {
    command: 'xdg-open',
    args: [url],
  });
  assert.deepEqual(openerCommand('darwin', url), {
    command: 'open',
    args: [url],
  });
  assert.deepEqual(openerCommand('win32', url), {
    command: 'rundll32',
    args: ['url.dll,FileProtocolHandler', url],
  });
});
