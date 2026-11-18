(function () {
  'use strict';

  var auth = window.ChampionAdminAuth;
  var loginView = document.getElementById('blogLoginView');
  var resetView = document.getElementById('blogResetView');
  var loginForm = document.getElementById('blogLoginForm');
  var resetForm = document.getElementById('blogResetForm');
  var email = document.getElementById('email');
  var password = document.getElementById('password');
  var resetEmail = document.getElementById('resetEmail');
  var loginError = document.getElementById('loginError');
  var resetError = document.getElementById('resetError');
  var resetSuccess = document.getElementById('resetSuccess');
  var loginSubmit = document.getElementById('blogLoginSubmit');
  var resetSubmit = document.getElementById('blogResetSubmit');
  var resetAgain = document.getElementById('resetAnotherEmail');
  var toggle = document.getElementById('togglePassword');
  var loginBusy = false;
  var resetBusy = false;
  var sessionBusy = false;

  if (!loginForm || !resetForm) return;

  function feedback(target, message) {
    target.textContent = message || '';
    target.hidden = !message;
  }

  function busy(button, enabled, normalLabel, loadingLabel) {
    button.disabled = enabled;
    button.classList.toggle('is-busy', enabled);
    button.setAttribute('aria-busy', String(enabled));
    button.querySelector('span').textContent = enabled ? loadingLabel : normalLabel;
  }

  function setResetMode(enabled) {
    if (loginBusy || resetBusy || sessionBusy) return;
    loginView.hidden = enabled;
    resetView.hidden = !enabled;
    feedback(loginError, '');
    feedback(resetError, '');
    email.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
    resetEmail.removeAttribute('aria-invalid');
    resetSuccess.hidden = true;
    resetForm.hidden = false;
    resetAgain.hidden = true;
    password.type = 'password';
    password.value = '';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Mostrar senha');
    toggle.classList.remove('is-visible');
    if (enabled) {
      resetEmail.value = email.value.trim();
      resetEmail.focus();
      document.title = 'Recuperar acesso · Blog Champion';
    } else {
      if (resetEmail.value.trim()) email.value = resetEmail.value.trim();
      email.focus();
      document.title = 'Entrar no painel do blog · Champion';
    }
  }

  if (!auth || typeof auth.login !== 'function') {
    feedback(loginError, 'Não foi possível carregar o acesso. Recarregue a página e tente novamente.');
    loginSubmit.disabled = true;
  }

  toggle.addEventListener('click', function () {
    var show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    toggle.classList.toggle('is-visible', show);
    password.focus();
  });

  document.getElementById('openPasswordReset').addEventListener('click', function () { setResetMode(true); });
  document.getElementById('backToBlogLogin').addEventListener('click', function () { setResetMode(false); });
  resetAgain.addEventListener('click', function () {
    resetSuccess.hidden = true;
    resetAgain.hidden = true;
    resetForm.hidden = false;
    resetEmail.focus();
    resetEmail.select();
  });

  email.addEventListener('input', function () { email.removeAttribute('aria-invalid'); feedback(loginError, ''); });
  password.addEventListener('input', function () { password.removeAttribute('aria-invalid'); feedback(loginError, ''); });
  resetEmail.addEventListener('input', function () { resetEmail.removeAttribute('aria-invalid'); feedback(resetError, ''); });

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (loginBusy || sessionBusy || !loginForm.reportValidity()) return;
    if (!auth || typeof auth.login !== 'function') return;
    loginBusy = true;
    feedback(loginError, '');
    busy(loginSubmit, true, 'Entrar no painel', 'Entrando…');
    try {
      await auth.login(email.value.trim().toLowerCase(), password.value);
      window.location.replace('/painel-blog');
    } catch (error) {
      var message = error && error.message ? error.message : 'Não foi possível entrar. Tente novamente.';
      feedback(loginError, message);
      if (/incorret[oa]s?|credenciais/i.test(message)) {
        password.setAttribute('aria-invalid', 'true');
        password.focus();
      }
    } finally {
      loginBusy = false;
      busy(loginSubmit, false, 'Entrar no painel', 'Entrando…');
    }
  });

  resetForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (resetBusy || !resetForm.reportValidity()) return;
    if (!auth || typeof auth.requestPasswordReset !== 'function') {
      feedback(resetError, 'A recuperação está indisponível no momento. Recarregue a página e tente novamente.');
      return;
    }
    resetBusy = true;
    feedback(resetError, '');
    busy(resetSubmit, true, 'Enviar instruções', 'Enviando…');
    try {
      await auth.requestPasswordReset(resetEmail.value.trim().toLowerCase());
      resetForm.hidden = true;
      resetSuccess.hidden = false;
      resetAgain.hidden = false;
      resetSuccess.focus();
    } catch (error) {
      feedback(resetError, error && error.message ? error.message : 'Não foi possível enviar as instruções. Tente novamente.');
      resetEmail.focus();
    } finally {
      resetBusy = false;
      busy(resetSubmit, false, 'Enviar instruções', 'Enviando…');
    }
  });

  async function checkExistingSession() {
    if (!auth || typeof auth.hasAuthorizedSession !== 'function') return;
    sessionBusy = true;
    document.getElementById('openPasswordReset').disabled = true;
    busy(loginSubmit, true, 'Entrar no painel', 'Verificando acesso…');
    try {
      if (await auth.hasAuthorizedSession()) window.location.replace('/painel-blog');
    } catch (error) {
      // A failed verification stays on the login screen; local markers are not authorization.
    } finally {
      sessionBusy = false;
      document.getElementById('openPasswordReset').disabled = false;
      busy(loginSubmit, false, 'Entrar no painel', 'Verificando acesso…');
    }
  }
  checkExistingSession();
})();
