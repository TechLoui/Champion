import { getAdminStore } from './admin-store.js';

(async function () {
  'use strict';

  function setTextAfterIcon(node, text) {
    if (!node || !text) return;
    const textNode = Array.from(node.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.nodeValue = text;
      return;
    }
    node.append(document.createTextNode(text));
  }

  function whatsappUrl(phone) {
    return `https://api.whatsapp.com/send/?phone=${encodeURIComponent(phone)}&type=phone_number&app_absent=0`;
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

    if (settings.whatsapp) {
      document.querySelectorAll('a[href*="api.whatsapp.com"]').forEach((link) => {
        link.href = whatsappUrl(settings.whatsapp);
      });
    }
  } catch (error) {
    console.error('Não foi possível carregar configurações do site.', error);
  }
})();
