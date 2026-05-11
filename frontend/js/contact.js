'use strict';

(function () {
  const API_URL = (
    typeof window !== 'undefined' && window.CHAMPION_API_URL
  ) || 'https://champion-backend.up.railway.app/api/leads';

  const form     = document.getElementById('contactForm');
  const feedback = document.getElementById('contactFeedback');
  const submit   = form?.querySelector('button[type="submit"]');

  if (!form) return;

  function setFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.type = type || '';
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.textContent = busy ? 'Enviando...' : (submit.dataset.label || 'Enviar mensagem');
    if (!submit.dataset.label && !busy) submit.dataset.label = submit.textContent;
  }

  if (submit && !submit.dataset.label) {
    submit.dataset.label = submit.textContent;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setFeedback('');
    setBusy(true);

    const data = {
      name:    String(form.elements.name?.value    || '').trim(),
      email:   String(form.elements.email?.value   || '').trim(),
      phone:   String(form.elements.phone?.value   || '').trim(),
      message: String(form.elements.message?.value || '').trim(),
      source:  'Site'
    };

    if (!data.name) {
      setFeedback('Por favor, informe seu nome.', 'error');
      setBusy(false);
      form.elements.name?.focus();
      return;
    }
    if (!data.email && !data.phone) {
      setFeedback('Informe ao menos e-mail ou telefone.', 'error');
      setBusy(false);
      form.elements.email?.focus();
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erro ${response.status}`);
      }

      form.reset();
      setFeedback('Mensagem enviada! Entraremos em contato em breve.', 'success');
    } catch (err) {
      setFeedback(
        err.message || 'Não foi possível enviar. Tente novamente ou entre em contato pelo WhatsApp.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  });
})();
