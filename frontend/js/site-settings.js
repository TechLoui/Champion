import { getAdminStore } from './admin-store.js';

(async function () {
  'use strict';

  function setTextAfterIcon(node, text) {
    if (!node || !text) return;
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) child.remove();
    });
    node.append(document.createTextNode(text));
  }

  function whatsappUrl(phone) {
    return `https://api.whatsapp.com/send/?phone=${encodeURIComponent(phone)}&type=phone_number&app_absent=0`;
  }

  function phoneUrl(phone) {
    return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
  }

  try {
    const store = await getAdminStore();
    const settings = await store.getSettings();
    if (!settings) return;

    const topbarSpans = Array.from(document.querySelectorAll('.topbar-info span'));
    const promo = document.querySelector('.topbar .pill');
    if (promo && settings.promoText) promo.textContent = settings.promoText;
    if (topbarSpans[1] && settings.phone) setTextAfterIcon(topbarSpans[1], settings.phone);
    if (topbarSpans[2] && settings.email) setTextAfterIcon(topbarSpans[2], settings.email);

    if (settings.phone) {
      document.querySelectorAll('[data-site-phone]').forEach((node) => {
        node.textContent = settings.phone;
      });
      document.querySelectorAll('a[data-site-phone-link]').forEach((link) => {
        link.href = phoneUrl(settings.phone);
      });
    }

    if (settings.email) {
      document.querySelectorAll('[data-site-email]').forEach((node) => {
        node.textContent = settings.email;
      });
      document.querySelectorAll('a[data-site-email-link]').forEach((link) => {
        link.href = `mailto:${settings.email}`;
      });
    }

    if (settings.whatsapp) {
      document.querySelectorAll('a[href*="api.whatsapp.com"]').forEach((link) => {
        link.href = whatsappUrl(settings.whatsapp);
      });
    }
  } catch (error) {
    console.error('Não foi possível carregar configurações do site.', error);
  }
})();
