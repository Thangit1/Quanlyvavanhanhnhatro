/* eslint-disable @typescript-eslint/no-require-imports */
// Real HTTP against the synthetic acceptance server. Never points at the live application.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ready = JSON.parse(fs.readFileSync('D:/DATN/prompt11-browser-ready.json', 'utf8'));
assert.match(ready.api, /^http:\/\/127\.0\.0\.1:(?!8080\b)\d+\/api$/);
const cases = [];
async function request(token, path, expected, method = 'GET', body) {
  const response = await fetch(ready.api + path, {method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: body ? JSON.stringify(body) : undefined});
  const json = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${json.errorCode || ''}`);
  cases.push({method, path, expected, actual: response.status, status: 'PASS'});
  return json.data;
}
async function main() {
  await request(null, '/communications/inbox', 401);
  await request(null, '/v1/health', 200);
  for (const role of ['OWNER','MANAGER','ACCOUNTANT','TECHNICIAN','TENANT']) {
    const login = await request(null, '/auth/login', 200, 'POST', {email: ready[role.toLowerCase()+'Email'], password: ready.password, requestedRole: role});
    const token = login.accessToken;
    const inbox = await request(token, '/communications/inbox', 200);
    assert.ok(Array.isArray(inbox.rows));
    await request(token, '/communications/options', 200);
    await request(token, '/communications/preferences', 200);
    await request(token, '/communications/calendar?from=2026-11-01&to=2026-11-30', 200);
    await request(token, '/communications/inbox?propertyId=all', 400);
    await request(token, '/communications/inbox?from=not-a-date', 400);
    await request(token, '/communications/calendar', 400);
    if (role !== 'OWNER') await request(token, '/communications/inbox?propertyId=99999999', 403);
    await request(token, '/communications/inbox/read-all', 200, 'POST');
    await request(token, '/auth/logout', 200, 'POST');
  }
}
main().then(() => {
  fs.writeFileSync('../docs/qa/audit11/http-communications.json', JSON.stringify({runId:ready.runId,status:'PASS',cases},null,2));
  console.log(`${cases.length} real HTTP checks passed`);
}).catch(error => {console.error(error.message);process.exitCode=1;});
