'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual source functions with dependency mocks. No Firebase SDK is
// loaded, no account is accessed, and no password-reset email can be sent.
const authPath = path.join(__dirname, '../frontend/js/admin-auth.js');
const source = fs.readFileSync(authPath, 'utf8');

function sourceFunction(name, nextFunction, context) {
  const declaration = `async function ${name}(`;
  const start = source.indexOf(declaration);
  const end = source.indexOf(`\n  async function ${nextFunction}(`, start);
  assert.ok(start >= 0 && end > start, `Locate the actual ${name} source function.`);
  return vm.runInNewContext(`${source.slice(start, end)}\n${name};`, context, {
    filename: `${authPath}:${name}`,
    timeout: 1000
  });
}

function loginFixture({ ready = true, configured = true } = {}) {
  const auth = {};
  const legacyEmail = 'local-editor@example.invalid';
  const legacyPassword = 'local-fixture-password';
  const calls = { signedIn: [], checkedUsers: [], written: [] };
  const context = {
    Error,
    firebaseConfigured: configured,
    initFirebase: async () => ready,
    firebase: {
      auth,
      api: {
        signInWithEmailAndPassword: async (actualAuth, email, password) => {
          assert.equal(actualAuth, auth);
          calls.signedIn.push({ email, password });
          return { user: { uid: 'login-editor' } };
        }
      }
    },
    isBlogAdmin: async uid => { calls.checkedUsers.push(uid); return true; },
    writeSession: (key, data) => calls.written.push({ key, data }),
    LOCAL_ADMIN_EMAIL: legacyEmail,
    LOCAL_ADMIN_PASSWORD: legacyPassword,
    ADMIN_SESSION_KEY: 'test-admin-marker',
    BLOG_SESSION_KEY: 'test-blog-marker'
  };
  return { login: sourceFunction('login', 'requestPasswordReset', context), calls, legacyEmail, legacyPassword };
}

function resetFixture({ ready = true, configured = true, failure = '' } = {}) {
  const auth = {};
  const calls = { initialize: 0, sent: [] };
  const context = {
    Error,
    firebaseConfigured: configured,
    initFirebase: async () => { calls.initialize++; return ready; },
    firebase: {
      auth,
      api: {
        sendPasswordResetEmail: async (actualAuth, email) => {
          assert.equal(actualAuth, auth);
          calls.sent.push(email);
          if (failure) throw Object.assign(new Error('Mock service response'), { code: failure });
        }
      }
    }
  };
  return { reset: sourceFunction('requestPasswordReset', 'logout', context), calls };
}

function sessionFixture({
  ready = true,
  configured = true,
  user = { uid: 'test-editor' },
  restoredUser,
  allowed = true,
  readyFailure = false,
  marker = true
} = {}) {
  const calls = { order: [], cleared: [], checkedUsers: [] };
  const auth = {
    currentUser: user,
    authStateReady: async () => {
      calls.order.push('auth-ready');
      await Promise.resolve();
      if (readyFailure) throw new Error('Mock readiness unavailable');
      if (restoredUser !== undefined) auth.currentUser = restoredUser;
    }
  };
  const context = {
    firebaseConfigured: configured,
    firebase: { auth },
    initFirebase: async () => { calls.order.push('initialize'); return ready; },
    isBlogAdmin: async uid => { calls.order.push('authorize'); calls.checkedUsers.push(uid); return allowed; },
    clearSession: key => calls.cleared.push(key),
    isLogged: key => { assert.equal(key, 'test-blog-marker'); return marker; },
    ADMIN_SESSION_KEY: 'test-admin-marker',
    BLOG_SESSION_KEY: 'test-blog-marker'
  };
  return { check: sourceFunction('hasAuthorizedSession', 'getIdToken', context), calls, auth };
}

const results = [];
async function test(description, action) {
  await action();
  results.push(description);
}
function expectMarkersCleared(fixture) {
  assert.deepEqual(fixture.calls.cleared, ['test-admin-marker', 'test-blog-marker']);
}

(async () => {
  await test('Configured login unavailability never accepts legacy local credentials', async () => {
    const fixture = loginFixture({ ready: false, configured: true });
    await assert.rejects(fixture.login(fixture.legacyEmail, fixture.legacyPassword), /Não foi possível conectar ao serviço de acesso/);
    assert.deepEqual(fixture.calls.signedIn, []);
    assert.deepEqual(fixture.calls.written, []);
  });

  await test('Unknown login configuration never falls back to legacy local credentials', async () => {
    const fixture = loginFixture({ ready: false, configured: null });
    await assert.rejects(fixture.login(fixture.legacyEmail, fixture.legacyPassword), /Não foi possível conectar ao serviço de acesso/);
    assert.deepEqual(fixture.calls.signedIn, []);
    assert.deepEqual(fixture.calls.written, []);
  });

  await test('Intentionally unconfigured local login retains its existing behavior', async () => {
    const fixture = loginFixture({ ready: false, configured: false });
    const session = await fixture.login(fixture.legacyEmail, fixture.legacyPassword);
    assert.equal(session.mode, 'local');
    assert.equal(session.user, fixture.legacyEmail);
    assert.deepEqual(fixture.calls.signedIn, []);
    assert.deepEqual(fixture.calls.written.map(write => write.key), ['test-admin-marker', 'test-blog-marker']);
  });

  await test('Firebase login preserves password spaces and checks the real editor role', async () => {
    const fixture = loginFixture();
    const session = await fixture.login(' Editor@Example.invalid ', ' fixture password ');
    assert.deepEqual(fixture.calls.signedIn, [{ email: 'editor@example.invalid', password: ' fixture password ' }]);
    assert.deepEqual(fixture.calls.checkedUsers, ['login-editor']);
    assert.equal(session.mode, 'firebase');
    assert.equal(session.uid, 'login-editor');
    assert.deepEqual(fixture.calls.written.map(write => write.key), ['test-admin-marker', 'test-blog-marker']);
  });

  await test('Invalid recovery email never initializes or calls the service', async () => {
    const fixture = resetFixture();
    await assert.rejects(fixture.reset('invalid-address'), /e-mail válido/);
    assert.equal(fixture.calls.initialize, 0);
    assert.deepEqual(fixture.calls.sent, []);
  });

  await test('Recovery normalizes the email and uses the initialized Auth instance', async () => {
    const fixture = resetFixture();
    assert.equal(await fixture.reset(' Editor@Example.invalid '), undefined);
    assert.equal(fixture.calls.initialize, 1);
    assert.deepEqual(fixture.calls.sent, ['editor@example.invalid']);
  });

  await test('An unknown account has the same successful recovery result', async () => {
    const fixture = resetFixture({ failure: 'auth/user-not-found' });
    assert.equal(await fixture.reset('missing@example.invalid'), undefined);
    assert.deepEqual(fixture.calls.sent, ['missing@example.invalid']);
  });

  await test('Recovery network failures return a retry message', async () => {
    const fixture = resetFixture({ failure: 'auth/network-request-failed' });
    await assert.rejects(fixture.reset('editor@example.invalid'), /Sem conexão/);
    assert.equal(fixture.calls.sent.length, 1);
  });

  await test('Intentional local mode cannot send password-reset email', async () => {
    const fixture = resetFixture({ ready: false, configured: false });
    await assert.rejects(fixture.reset('editor@example.invalid'), /não está disponível neste ambiente/);
    assert.deepEqual(fixture.calls.sent, []);
  });

  await test('An unavailable configured recovery service cannot send email', async () => {
    const fixture = resetFixture({ ready: false, configured: true });
    await assert.rejects(fixture.reset('editor@example.invalid'), /Não foi possível conectar/);
    assert.deepEqual(fixture.calls.sent, []);
  });

  await test('Authorization waits for restored Auth state and verifies the user role', async () => {
    const fixture = sessionFixture({ user: null, restoredUser: { uid: 'restored-editor' } });
    assert.equal(await fixture.check(), true);
    assert.deepEqual(fixture.calls.order, ['initialize', 'auth-ready', 'authorize']);
    assert.deepEqual(fixture.calls.checkedUsers, ['restored-editor']);
    assert.deepEqual(fixture.calls.cleared, []);
  });

  await test('A revoked editor role clears both stale UI markers', async () => {
    const fixture = sessionFixture({ allowed: false });
    assert.equal(await fixture.check(), false);
    assert.deepEqual(fixture.calls.checkedUsers, ['test-editor']);
    expectMarkersCleared(fixture);
    assert.equal(fixture.auth.currentUser.uid, 'test-editor');
  });

  await test('An absent Auth user clears markers without requesting an editor role', async () => {
    const fixture = sessionFixture({ user: null });
    assert.equal(await fixture.check(), false);
    assert.deepEqual(fixture.calls.checkedUsers, []);
    expectMarkersCleared(fixture);
  });

  await test('Configured Firebase unavailability cannot authorize a local marker', async () => {
    const fixture = sessionFixture({ ready: false, configured: true, marker: true });
    assert.equal(await fixture.check(), false);
    assert.deepEqual(fixture.calls.order, ['initialize']);
    assert.deepEqual(fixture.calls.checkedUsers, []);
    expectMarkersCleared(fixture);
  });

  await test('Intentional unconfigured local development preserves its existing session', async () => {
    const fixture = sessionFixture({ ready: false, configured: false, marker: true });
    assert.equal(await fixture.check(), true);
    assert.deepEqual(fixture.calls.checkedUsers, []);
    assert.deepEqual(fixture.calls.cleared, []);
  });

  await test('An absent intentional local session clears both markers', async () => {
    const fixture = sessionFixture({ ready: false, configured: false, marker: false });
    assert.equal(await fixture.check(), false);
    expectMarkersCleared(fixture);
  });

  await test('Auth restoration failures cannot redirect through a stale marker', async () => {
    const fixture = sessionFixture({ readyFailure: true, marker: true });
    assert.equal(await fixture.check(), false);
    assert.deepEqual(fixture.calls.checkedUsers, []);
    expectMarkersCleared(fixture);
  });

  console.log(`OK: ${results.length} blog authentication checks passed (mocked, no network or email).`);
})().catch(error => {
  console.error(`Blog authentication check failed after ${results.length} completed checks.`);
  console.error(error);
  process.exitCode = 1;
});
