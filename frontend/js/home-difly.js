'use strict';

/* Entradas que se repetem ao voltar a seção à tela e parallax leve nos recortes. */
(function () {
  const home = document.querySelector('.difly-home');
  if (!home) return;

  /* A home tem texto próprio; estende o dicionário sem alterar outras páginas. */
  if (window.ChampionI18n) {
    window.ChampionI18n.extend('en', {
      'DIFLY · CONTROLE DA MOSCA': 'DIFLY · FLY CONTROL',
      'DIFLY É BÁSICO': 'DIFLY IS ESSENTIAL',
      'Indispensável pra controle de mosca!': 'Essential for fly control!',
      '6 kg · 300 g · caixa 10×20 g': '6 kg · 300 g · box of 10×20 g',
      '6 kg · 1 kg · 300 g (cx. 24)': '6 kg · 1 kg · 300 g (box of 24)',
      'CHAMPION EM VÍDEO': 'CHAMPION ON VIDEO',
      'Apresentamos o Difly': 'Introducing Difly',
      'Assistir ao vídeo': 'Watch the video',
      'Assistir no YouTube': 'Watch on YouTube',
      'Reproduzir Apresentamos o Difly no YouTube': 'Play Introducing Difly on YouTube',
      'por cabeça/120 dias*': 'per head/120 days*',
      'Conhecer Difly': 'Explore Difly',
      '*Simulação: barrica de 6 kg a R$ 2.400 para 833 animais.': '*Example based on a 6 kg drum at R$ 2,400 for 833 animals.',
      'LINHA DIFLY · S3': 'DIFLY LINE · S3',
      'O fim das infestações no rebanho.': 'End infestations in the herd.',
      'Conhecer Difly S3': 'Explore Difly S3',
      'no campo.': 'in the field.',
      'De Anápolis-GO para todo o país, unimos tradição e ciência em soluções que fazem diferença no campo.': 'From Anápolis to farms across Brazil, we bring tradition and science together in solutions that make a difference.',
      '01 / CONTROLE DA MOSCA': '01 / FLY CONTROL',
      'Foco na mosca.': 'Focused on flies.',
      'Só R$ 2,88 por cabeça em 120 dias.*': 'Only R$ 2.88 per head over 120 days.*',
      'R$ 0,72 por mês · 2,4 centavos por dia.': 'R$ 0.72 per month · 2.4 cents per day.',
      'DIFLY · FAÇA AS CONTAS': 'DIFLY · COMPARE COSTS',
      'Compare o custo': 'Compare the cost',
      'por animal.': 'per animal.',
      'Comparação do custo do produto Difly com brincos para cada período de tratamento': 'Difly product cost compared with ear tags for each treatment period',
      'Período': 'Period',
      'Brinco': 'Ear tag',
      'Economia': 'Savings',
      '120 dias': '120 days',
      '150 dias': '150 days',
      '180 dias': '180 days',
      'Economia de até': 'Savings of up to',
      'no custo do produto.': 'on product cost.',
      '*Valores de referência fornecidos para esta simulação. Difly calculado com barrica de 6 kg a R$ 2.400. A comparação considera somente o custo do produto por animal; os preços podem variar.': '*Reference figures supplied for this example. Difly uses a 6 kg drum at R$ 2,400. The comparison covers product cost per animal only; prices may vary.',
      'Sem mosca': 'No flies',
      'Sem manejo': 'No handling',
      'Sem resíduos': 'No residues',
      'Ver Difly e comprar': 'View Difly and buy',
      'DIRETO NO COCHO': 'STRAIGHT IN THE FEED',
      'Difly é': 'Difly is',
      'básico.': 'essential.',
      'Controle a infestação desde a origem.': 'Control the infestation at its source.',
      'Exemplo no cocho: 60 g de sal/suplemento por animal ao dia.': 'Trough example: 60 g of salt/supplement per animal per day.',
      '120 DIAS DE TRATAMENTO*': '120 DAYS OF TREATMENT*',
      'Só': 'Only',
      'por cabeça': 'per head',
      'por cabeça / mês': 'per head / month',
      '2,4 centavos por dia': '2.4 cents per day',
      '*Simulação para 120 dias com barrica de 6 kg a R$ 2.400 e rendimento de 833 animais. Valores arredondados; o preço atual pode variar. Os 60 g são de sal/suplemento, não de Difly. Ajuste a mistura conforme o rótulo.': '*120-day example using a 6 kg drum at R$ 2,400 for 833 animals. Rounded figures; current prices may vary. The 60 g refers to salt/supplement, not Difly. Adjust the mixture according to the label.',
      'DIFLY É BÁSICO NO TRATO': 'DIFLY IS ESSENTIAL IN FEED',
      'Antes da': 'Before the',
      'mosca adulta.': 'adult fly.',
      'Brinco na mosca adulta. Difly antes de ela nascer.': 'Ear tags for adult flies. Difly before they emerge.',
      'No confinamento, controle a origem.': 'In feedlots, control flies at the source.',
      'Ovos no esterco': 'Eggs in manure',
      'Larva': 'Larva',
      'Pupa': 'Pupa',
      'Mosca adulta': 'Adult fly',
      'DIFLY: CORTA O CICLO NA RAIZ DO PROBLEMA': 'DIFLY: BREAKS THE CYCLE AT THE SOURCE',
      'BRINCO: SÓ ADULTA': 'EAR TAG: ADULT FLIES ONLY',
      'Esquema ilustrativo. Use Difly conforme o rótulo e a orientação técnica.': 'Illustrative diagram. Use Difly according to the label and technical guidance.',
      '02 / MOSCA + CARRAPATO': '02 / FLIES + TICKS',
      'Mosca e carrapato.': 'Flies and ticks.',
      'Sem carrapato': 'No ticks',
      'por cabeça em 120 dias': 'per head over 120 days',
      '· R$ 0,22 por dia': '· R$ 0.22 per day',
      'Ver Difly S3 e comprar': 'View Difly S3 and buy',
      'LOJA OFICIAL CHAMPION': 'OFFICIAL CHAMPION STORE',
      'Difly ou S3.': 'Difly or S3.',
      'Compre aqui.': 'Buy here.',
      'Veja preço e disponibilidade atual antes de comprar.': 'Check current prices and availability before buying.',
      'ALÉM DA LINHA DIFLY': 'BEYOND THE DIFLY LINE',
      'Barrica de Difly 6 kg': '6 kg Difly drum',
      'Embalagem de Difly S3 6 kg': '6 kg Difly S3 pack',
      'Apresentações de Difly': 'Difly pack sizes',
      'Apresentações de Difly S3': 'Difly S3 pack sizes',
      'Escolha a apresentação de Difly': 'Choose a Difly pack size',
      'Escolha a apresentação de Difly S3': 'Choose a Difly S3 pack size',
      'Balde de Difly 6 kg': '6 kg Difly bucket',
      'Pote de Difly 300 g': '300 g Difly tub',
      'Caixa de Difly com 10 sachês de 20 g': 'Difly box with ten 20 g sachets',
      'Embalagem de Difly S3 1 kg': '1 kg Difly S3 pack',
      'Sachê de Difly S3 300 g, vendido em caixa com 24 unidades': '300 g Difly S3 pouch, sold in boxes of 24',
      'Rebanho bovino em pasto ao pôr do sol': 'Cattle herd grazing at sunset',
      'Rebanho bovino no pasto ao entardecer': 'Cattle herd grazing at dusk'
    });
    window.ChampionI18n.extend('es', {
      'DIFLY · CONTROLE DA MOSCA': 'DIFLY · CONTROL DE MOSCAS',
      'DIFLY É BÁSICO': 'DIFLY ES ESENCIAL',
      'Indispensável pra controle de mosca!': '¡Indispensable para el control de moscas!',
      '6 kg · 300 g · caixa 10×20 g': '6 kg · 300 g · caja de 10×20 g',
      '6 kg · 1 kg · 300 g (cx. 24)': '6 kg · 1 kg · 300 g (caja de 24)',
      'CHAMPION EM VÍDEO': 'CHAMPION EN VÍDEO',
      'Apresentamos o Difly': 'Presentamos Difly',
      'Assistir ao vídeo': 'Ver el vídeo',
      'Assistir no YouTube': 'Ver en YouTube',
      'Reproduzir Apresentamos o Difly no YouTube': 'Reproducir Presentamos Difly en YouTube',
      'por cabeça/120 dias*': 'por cabeza/120 días*',
      'Conhecer Difly': 'Conocer Difly',
      '*Simulação: barrica de 6 kg a R$ 2.400 para 833 animais.': '*Ejemplo basado en un barril de 6 kg a R$ 2.400 para 833 animales.',
      'LINHA DIFLY · S3': 'LÍNEA DIFLY · S3',
      'O fim das infestações no rebanho.': 'El fin de las infestaciones en el rebaño.',
      'Conhecer Difly S3': 'Conocer Difly S3',
      'no campo.': 'en el campo.',
      'De Anápolis-GO para todo o país, unimos tradição e ciência em soluções que fazem diferença no campo.': 'Desde Anápolis hasta todo Brasil, unimos tradición y ciencia en soluciones que marcan la diferencia en el campo.',
      '01 / CONTROLE DA MOSCA': '01 / CONTROL DE MOSCAS',
      'Foco na mosca.': 'Foco en la mosca.',
      'Só R$ 2,88 por cabeça em 120 dias.*': 'Solo R$ 2,88 por cabeza durante 120 días.*',
      'R$ 0,72 por mês · 2,4 centavos por dia.': 'R$ 0,72 por mes · 2,4 centavos por día.',
      'DIFLY · FAÇA AS CONTAS': 'DIFLY · COMPARE COSTOS',
      'Compare o custo': 'Compare el costo',
      'por animal.': 'por animal.',
      'Comparação do custo do produto Difly com brincos para cada período de tratamento': 'Costo del producto Difly frente a aretes para cada período de tratamiento',
      'Período': 'Período',
      'Brinco': 'Arete',
      'Economia': 'Ahorro',
      '120 dias': '120 días',
      '150 dias': '150 días',
      '180 dias': '180 días',
      'Economia de até': 'Ahorro de hasta',
      'no custo do produto.': 'en el costo del producto.',
      '*Valores de referência fornecidos para esta simulação. Difly calculado com barrica de 6 kg a R$ 2.400. A comparação considera somente o custo do produto por animal; os preços podem variar.': '*Valores de referencia proporcionados para este ejemplo. Difly se calcula con un barril de 6 kg a R$ 2.400. La comparación cubre solo el costo del producto por animal; los precios pueden variar.',
      'Sem mosca': 'Sin moscas',
      'Sem manejo': 'Sin manejo',
      'Sem resíduos': 'Sin residuos',
      'Ver Difly e comprar': 'Ver Difly y comprar',
      'DIRETO NO COCHO': 'DIRECTO EN EL COMEDERO',
      'Difly é': 'Difly es',
      'básico.': 'básico.',
      'Controle a infestação desde a origem.': 'Controla la infestación desde el origen.',
      'Exemplo no cocho: 60 g de sal/suplemento por animal ao dia.': 'Ejemplo en el comedero: 60 g de sal/suplemento por animal al día.',
      '120 DIAS DE TRATAMENTO*': '120 DÍAS DE TRATAMIENTO*',
      'Só': 'Solo',
      'por cabeça': 'por cabeza',
      'por cabeça / mês': 'por cabeza / mes',
      '2,4 centavos por dia': '2,4 centavos por día',
      '*Simulação para 120 dias com barrica de 6 kg a R$ 2.400 e rendimento de 833 animais. Valores arredondados; o preço atual pode variar. Os 60 g são de sal/suplemento, não de Difly. Ajuste a mistura conforme o rótulo.': '*Ejemplo de 120 días con un barril de 6 kg a R$ 2.400 para 833 animales. Cifras redondeadas; el precio actual puede variar. Los 60 g son de sal/suplemento, no de Difly. Ajusta la mezcla según la etiqueta.',
      'DIFLY É BÁSICO NO TRATO': 'DIFLY ES BÁSICO EN EL COMEDERO',
      'Antes da': 'Antes de la',
      'mosca adulta.': 'mosca adulta.',
      'Brinco na mosca adulta. Difly antes de ela nascer.': 'Arete para la mosca adulta. Difly antes de que nazca.',
      'No confinamento, controle a origem.': 'En el confinamiento, controla desde el origen.',
      'Ovos no esterco': 'Huevos en el estiércol',
      'Larva': 'Larva',
      'Pupa': 'Pupa',
      'Mosca adulta': 'Mosca adulta',
      'DIFLY: CORTA O CICLO NA RAIZ DO PROBLEMA': 'DIFLY: CORTA EL CICLO EN SU ORIGEN',
      'BRINCO: SÓ ADULTA': 'ARETE: SOLO MOSCAS ADULTAS',
      'Esquema ilustrativo. Use Difly conforme o rótulo e a orientação técnica.': 'Diagrama ilustrativo. Usa Difly según la etiqueta y la orientación técnica.',
      '02 / MOSCA + CARRAPATO': '02 / MOSCAS + GARRAPATAS',
      'Mosca e carrapato.': 'Mosca y garrapata.',
      'Sem carrapato': 'Sin garrapatas',
      'por cabeça em 120 dias': 'por cabeza en 120 días',
      '· R$ 0,22 por dia': '· R$ 0,22 por día',
      'Ver Difly S3 e comprar': 'Ver Difly S3 y comprar',
      'LOJA OFICIAL CHAMPION': 'TIENDA OFICIAL CHAMPION',
      'Difly ou S3.': 'Difly o S3.',
      'Compre aqui.': 'Compra aquí.',
      'Veja preço e disponibilidade atual antes de comprar.': 'Consulta los precios y la disponibilidad actuales antes de comprar.',
      'ALÉM DA LINHA DIFLY': 'MÁS ALLÁ DE DIFLY',
      'Barrica de Difly 6 kg': 'Barril de Difly de 6 kg',
      'Embalagem de Difly S3 6 kg': 'Envase de Difly S3 de 6 kg',
      'Apresentações de Difly': 'Presentaciones de Difly',
      'Apresentações de Difly S3': 'Presentaciones de Difly S3',
      'Escolha a apresentação de Difly': 'Elige la presentación de Difly',
      'Escolha a apresentação de Difly S3': 'Elige la presentación de Difly S3',
      'Balde de Difly 6 kg': 'Cubeta de Difly de 6 kg',
      'Pote de Difly 300 g': 'Envase de Difly de 300 g',
      'Caixa de Difly com 10 sachês de 20 g': 'Caja de Difly con diez sobres de 20 g',
      'Embalagem de Difly S3 1 kg': 'Envase de Difly S3 de 1 kg',
      'Sachê de Difly S3 300 g, vendido em caixa com 24 unidades': 'Sobre de Difly S3 de 300 g, vendido en cajas de 24',
      'Rebanho bovino em pasto ao pôr do sol': 'Rebaño bovino en el pasto al atardecer',
      'Rebanho bovino no pasto ao entardecer': 'Rebaño bovino en el pasto al anochecer'
    });
    window.ChampionI18n.apply(document.documentElement.dataset.lang || 'pt');
  }

  const videoSlot = home.querySelector('[data-video-slot]');
  const videoButton = videoSlot?.querySelector('[data-video-play]');
  videoButton?.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/QjwhCcvCuho?autoplay=1&rel=0';
    iframe.title = 'Apresentamos o Difly | Champion Saúde Animal';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    videoSlot.replaceChildren(iframe);
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  home.querySelectorAll('[data-df-variant-carousel]').forEach((stage) => {
    const slides = Array.from(stage.querySelectorAll('.df-variant-slide'));
    const buttons = Array.from(stage.querySelectorAll('[data-df-variant-go]'));
    let current = 0;
    let timer;
    let depthTimer;
    let visible = false;
    let hovered = false;
    let focused = false;
    const show = (next, animate = true) => {
      const incoming = (next + slides.length) % slides.length;
      if (animate && incoming === current) return;
      const outgoingSlide = slides[current];
      window.clearTimeout(depthTimer);
      slides.forEach((slide) => slide.classList.remove('is-arriving', 'is-leaving'));
      current = incoming;
      slides.forEach((slide, index) => {
        const active = index === current;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('is-next', index === (current + 1) % slides.length);
        slide.classList.toggle('is-prev', index === (current - 1 + slides.length) % slides.length);
        if (active) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
      });
      if (animate && !reducedMotion && outgoingSlide !== slides[current]) {
        outgoingSlide.classList.add('is-leaving');
        slides[current].classList.add('is-arriving');
        depthTimer = window.setTimeout(() => {
          outgoingSlide.classList.remove('is-leaving');
          slides[current].classList.remove('is-arriving');
        }, 430);
      }
      buttons.forEach((button, index) => {
        const active = index === current;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    };
    show(0, false);
    const schedule = () => {
      window.clearInterval(timer);
      if (!reducedMotion && visible && !hovered && !focused && !document.hidden && slides.length > 1) {
        timer = window.setInterval(() => show(current + 1), 3500);
      }
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      show(Number(button.dataset.dfVariantGo));
      schedule();
    }));
    stage.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    stage.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    stage.addEventListener('focusin', () => { focused = true; schedule(); });
    stage.addEventListener('focusout', () => { focused = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: .35 }).observe(stage);
    } else {
      visible = true;
      schedule();
    }
  });
  const focusSections = Array.from(home.querySelectorAll('.df-story, .df-basic, .df-cycle'));
  if (focusSections.length && 'IntersectionObserver' in window) {
    const visibleSections = new Set();
    const focusObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      });
      document.body.classList.toggle('df-focus-visible', visibleSections.size > 0);
    }, { threshold: 0.12 });
    focusSections.forEach((section) => focusObserver.observe(section));
  }

  const reveals = Array.from(home.querySelectorAll('.df-reveal'));
  if (reducedMotion || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('df-motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      target.classList.toggle('is-inview', isIntersecting);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
  reveals.forEach((element) => observer.observe(element));

  const floating = Array.from(home.querySelectorAll('[data-df-float]'));
  let scheduled = false;
  function updateFloat() {
    const viewportCenter = window.innerHeight / 2;
    floating.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
      const distance = (rect.top + rect.height / 2 - viewportCenter) / Math.max(window.innerHeight, 1);
      const direction = Number(element.dataset.dfFloat) || 1;
      const shift = Math.max(-28, Math.min(28, -distance * 32 * direction));
      element.style.setProperty('--df-shift', `${shift.toFixed(1)}px`);
    });
    scheduled = false;
  }
  function scheduleFloat() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateFloat);
  }
  window.addEventListener('scroll', scheduleFloat, { passive: true });
  window.addEventListener('resize', scheduleFloat, { passive: true });
  scheduleFloat();
})();
