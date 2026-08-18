'use strict';

/**
 * Champion · Tradução do conteúdo do site (pt / en / es)
 *
 * Carregado como <script> comum, ANTES do main.js — que chama
 * ChampionI18n.apply() a cada troca de idioma.
 *
 * ── Por que traduzir por texto de origem, e não por data-i18n ──
 * O site é estático, sem build, com o mesmo cabeçalho e rodapé repetidos em
 * seis arquivos. Marcar ~200 elementos por página à mão seria trabalhoso e,
 * pior, quebraria em silêncio: quem editasse um texto sem lembrar de mexer no
 * dicionário deixaria a tradução para trás sem nenhum aviso.
 *
 * Aqui a chave É o texto em português. Traduzir algo novo é acrescentar uma
 * linha ao dicionário; o que não estiver traduzido continua em português, que
 * é o comportamento certo para um site brasileiro.
 *
 * ── O que NÃO é traduzido, de propósito ──
 * Produto (nome, descrição, apresentação, modo de uso) vem do Shopify em
 * português, e post de blog vem do Firestore em português. Traduzir isso no
 * navegador seria reescrever texto de rótulo — justamente o que o resto do
 * projeto evita. Por isso esses contêineres entram na lista de exclusão.
 */

(function () {
  /* Nome próprio, endereço e nome de produto ficam como estão em qualquer
     idioma — por isso não aparecem nos dicionários. */
  const DICIONARIO = {
    en: {
      'FRETE GRÁTIS para pedidos acima de R$ 500': 'FREE SHIPPING on orders over R$ 500',

      '+67 anos': '+67 years',
      'de tradição na pecuária': 'of tradition in livestock farming',
      '+150 produtos': '+150 products',
      'para a sua fazenda': 'for your farm',
      'melhor empresa do setor': 'best company in the industry',
      'Brasil inteiro': 'All of Brazil',
      'distribuição em todo o país': 'nationwide distribution',

      'Linha de produtos': 'Product line',
      'Soluções para': 'Solutions for',
      'cada espécie': 'every species',
      'Da bovinocultura à avicultura, desenvolvemos produtos sob medida para a saúde, nutrição e produtividade do seu rebanho.': 'From cattle to poultry, we develop products tailored to the health, nutrition and productivity of your herd.',
      'Bovinos': 'Cattle',
      'Linha completa': 'Full line',
      'Equinos': 'Horses',
      'Saúde e performance': 'Health and performance',
      'Ovinos': 'Sheep',
      'Nutrição balanceada': 'Balanced nutrition',
      'Suínos': 'Swine',
      'Sanidade e ganho': 'Health and weight gain',
      'Aves': 'Poultry',
      'Saúde avícola': 'Poultry health',
      'Mineralização': 'Mineralization',

      'Produtos em destaque': 'Featured products',
      'Destaques para': 'Highlights to',
      'comprar agora': 'buy now',
      'Produtos Champion de alta procura, com aplicação prática no campo e compra rápida pelo carrinho.': 'High-demand Champion products, practical in the field and quick to buy through the cart.',
      'Ver todos': 'View all',
      'Mais vendido': 'Best seller',
      'Tripla ação': 'Triple action',
      'Ação ampla': 'Broad action',

      'no agro': 'in agribusiness',
      '3 gerações': '3 generations',
      'de evolução': 'of evolution',
      'Presença nacional': 'National presence',
      'Em todo o Brasil': 'Across Brazil',
      'Tecnologia própria': 'In-house technology',
      'Inovação contínua': 'Continuous innovation',
      'Reconhecimento no agro': 'Recognition in agribusiness',
      'Prêmios que comprovam': 'Awards that prove it',
      'Compromisso de verdade': 'Real commitment',
      'Com pecuaristas e o futuro': 'To farmers and the future',
      'Nossa história': 'Our story',
      'Mais de': 'More than',
      '67 anos': '67 years',
      'transformando a': 'transforming',
      'pecuária brasileira.': 'Brazilian livestock farming.',
      'Com sede em': 'Headquartered in',
      ', a Champion desenvolve soluções para a pecuária com mais de 67 anos, unindo tradição, ciência e compromisso com resultados reais no campo.': ', Champion has been developing livestock solutions for over 67 years, combining tradition, science and a commitment to real results in the field.',
      'Nossas tecnologias aumentam a': 'Our technologies increase',
      'produtividade': 'productivity',
      'reduzem custos': 'cut costs',
      'e elevam o': 'and raise',
      'desempenho do rebanho': 'herd performance',
      ', gerando mais rentabilidade para o produtor rural.': ', generating more profitability for the farmer.',
      'Reconhecimento que comprova nossa trajetória': 'Recognition that proves our track record',
      '4× eleita a melhor empresa de produtos veterinários do Brasil': '4× voted the best veterinary products company in Brazil',
      'Destaque no setor agropecuário': 'Standout in the agricultural sector',
      'Uma das Melhores Empresas para Você Trabalhar': 'One of the Best Companies to Work For',
      'A Champion é assim:': 'This is Champion:',
      'Cresce com o pecuarista': 'Grows alongside the farmer',
      'Produz com qualidade': 'Produces with quality',
      'Sem resíduos, com bem-estar': 'No residues, with animal welfare',
      'Menor custo total no mercado': 'Lowest total cost on the market',
      'Ver soluções para o seu rebanho': 'See solutions for your herd',
      'Assistir institucional': 'Watch our story',
      'Compromisso com o pecuarista. Sempre.': 'Committed to the farmer. Always.',
      'anos de mercado': 'years in the market',
      '"A Champion entende o pecuarista. Produto que funciona, suporte que aparece."': '"Champion understands the farmer. Products that work, support that shows up."',
      '— Pecuarista parceiro · Goiás': '— Partner farmer · Goiás',

      'Por que Champion': 'Why Champion',
      'Mais que produtos:': 'More than products:',
      'resultado real': 'real results',
      'no campo.': 'in the field.',
      'A maior pecuária comercial do mundo confia na Champion há': 'The largest commercial livestock industry in the world has trusted Champion for',
      'mais de 67 anos': 'over 67 years',
      '6 motivos': '6 reasons',
      'que fazem do nosso portfólio referência nacional em saúde e nutrição animal.': 'that make our portfolio a national benchmark in animal health and nutrition.',
      'Garantia Champion': 'Champion guarantee',
      'Mais de 67 anos comprovando eficácia. Se não funcionar, a gente resolve.': 'Over 67 years proving effectiveness. If it does not work, we sort it out.',
      'Frete para todo Brasil': 'Shipping across Brazil',
      'Entregamos em todo o território nacional. Acima de R$ 500, o frete é por nossa conta.': 'We deliver nationwide. Over R$ 500, shipping is on us.',
      'Suporte técnico': 'Technical support',
      'Veterinários e zootecnistas prontos para indicar a melhor solução para o seu rebanho.': 'Vets and animal scientists ready to recommend the best solution for your herd.',
      'Pagamento seguro': 'Secure payment',
      'Pix, boleto e cartão em até 6× sem juros. Compra protegida com criptografia SSL.': 'Pix, bank slip and card in up to 6 interest-free instalments. Purchase protected with SSL encryption.',
      'Atendimento direto': 'Direct support',
      'Fale com o time pelo WhatsApp. Dúvidas sobre dose, aplicação ou compra, sem burocracia.': 'Talk to the team on WhatsApp. Questions about dosage, application or buying, without red tape.',
      'Sem resíduos': 'No residues',
      'Linha desenvolvida sem deixar resíduos no leite e carne. Respeito ao bem-estar animal.': 'A line developed to leave no residues in milk or meat. Respect for animal welfare.',
      'Tradição e confiança': 'Tradition and trust',
      '+67 anos ao lado do pecuarista brasileiro.': '+67 years alongside the Brazilian farmer.',
      'Pesquisa, desenvolvimento e inovação constantes.': 'Constant research, development and innovation.',
      'Atendemos milhares de produtores em todo o Brasil.': 'We serve thousands of farmers across Brazil.',
      'Compromisso com o agro': 'Committed to agribusiness',
      'Soluções que geram produtividade com responsabilidade.': 'Solutions that deliver productivity, responsibly.',

      'Revenda Champion': 'Champion resellers',
      'Venda Champion na': 'Sell Champion in',
      'sua região': 'your region',
      'Portfólio completo de saúde e nutrição animal, suporte técnico e uma marca com mais de 67 anos de estrada no agro brasileiro. Acesse o portal da revenda e fale com a fábrica.': 'A complete animal health and nutrition portfolio, technical support and a brand with over 67 years in Brazilian agribusiness. Visit the reseller portal and talk to the factory.',
      'Acessar a revenda': 'Go to reseller portal',

      'Pecuaristas falam': 'Farmers speak',
      'A confiança de quem': 'The trust of those who',
      'vive do campo': 'live off the land',
      'Depoimentos reais de produtores rurais que escolhem Champion para cuidar do rebanho.': 'Real testimonials from farmers who choose Champion to care for their herds.',
      '"A linha Difly mudou nossa rotina. Reduziu 80% das moscas-dos-chifres e o gado ganhou peso muito mais rápido."': '"The Difly line changed our routine. It cut horn flies by 80% and the cattle gained weight much faster."',
      'Pecuarista · Goiás (1.200 cabeças)': 'Farmer · Goiás (1,200 head)',
      '"Comprei VER-MI-SAL pelo site, recebi em 4 dias. Custo-benefício imbatível, e o suporte técnico é excelente."': '"I bought VER-MI-SAL on the website and it arrived in 4 days. Unbeatable value, and the technical support is excellent."',
      'Cria e recria · Mato Grosso (850 cabeças)': 'Breeding and rearing · Mato Grosso (850 head)',
      '"Trabalho com Champion há 25 anos. Confiança e qualidade que não tem em outra marca. Recomendo de olhos fechados."': '"I have worked with Champion for 25 years. Trust and quality you will not find in another brand. I recommend it without hesitation."',
      'Confinamento · Minas Gerais (3.200 cabeças)': 'Feedlot · Minas Gerais (3,200 head)',

      'Um legado que': 'A legacy spanning',
      'contempla três gerações': 'three generations',
      'Assistir história Champion': 'Watch the Champion story',
      'Conheça a tradição, a tecnologia e o compromisso por trás das soluções para o campo.': 'Discover the tradition, technology and commitment behind our solutions for the field.',

      'Representantes': 'Representatives',
      'Estamos em': 'We are all over',
      'todo o Brasil': 'Brazil',
      'Encontre um representante mais perto de você ou fale com nosso time de atendimento. Trabalhamos com a maior pecuária comercial do mundo — todos os dias.': 'Find a representative near you or talk to our support team. We work with the largest commercial livestock industry in the world — every day.',
      'Onde encontrar': 'Where to find us',
      'Fale conosco': 'Contact us',
      'Quero ser contatado': 'Have us contact you',
      'Seu nome': 'Your name',
      'Seu e-mail': 'Your e-mail',
      'Seu telefone': 'Your phone',
      'Sua mensagem': 'Your message',
      'Enviar mensagem': 'Send message',

      'Empresa genuinamente brasileira com mais de 67 anos entrega resultados reais para a maior pecuária comercial do mundo.': 'A genuinely Brazilian company with over 67 years delivering real results to the largest commercial livestock industry in the world.',
      'Empresa': 'Company',
      'Navegação': 'Navigation',
      'Missão e Valores': 'Mission and values',
      'Jeito Champion': 'The Champion way',
      'Trabalhe Conosco': 'Careers',
      'Contato': 'Contact',
      '© 2026 Champion Farmoquímico Ltda. — CNPJ 37.866.100/0001-05. Todos os direitos reservados.': '© 2026 Champion Farmoquímico Ltda. — Company ID 37.866.100/0001-05. All rights reserved.',
      '© 2026 Champion Farmoquímico Ltda. Todos os direitos reservados.': '© 2026 Champion Farmoquímico Ltda. All rights reserved.',
      'Política de Privacidade': 'Privacy policy',
      'Termos de uso': 'Terms of use',

      'Seu carrinho': 'Your cart',
      'Seu carrinho está vazio.': 'Your cart is empty.',
      'Que tal adicionar um produto?': 'How about adding a product?',
      'Total': 'Total',
      'Finalizar pedido': 'Checkout',
      'Adicionado ao carrinho': 'Added to cart',

      /* Cabeçalhos das páginas internas */
      'Nossos produtos': 'Our products',
      'Todos os produtos': 'All products',
      'Conheça a Champion': 'Get to know Champion',
      'Sobre a Champion': 'About Champion',
      'Blog Champion': 'Champion blog',
      'Página Inicial': 'Home'
    },

    es: {
      'FRETE GRÁTIS para pedidos acima de R$ 500': 'ENVÍO GRATIS en pedidos superiores a R$ 500',

      '+67 anos': '+67 años',
      'de tradição na pecuária': 'de tradición en la ganadería',
      '+150 produtos': '+150 productos',
      'para a sua fazenda': 'para tu hacienda',
      'melhor empresa do setor': 'mejor empresa del sector',
      'Brasil inteiro': 'Todo Brasil',
      'distribuição em todo o país': 'distribución en todo el país',

      'Linha de produtos': 'Línea de productos',
      'Soluções para': 'Soluciones para',
      'cada espécie': 'cada especie',
      'Da bovinocultura à avicultura, desenvolvemos produtos sob medida para a saúde, nutrição e produtividade do seu rebanho.': 'De la ganadería bovina a la avicultura, desarrollamos productos a medida para la salud, nutrición y productividad de tu rebaño.',
      'Bovinos': 'Bovinos',
      'Linha completa': 'Línea completa',
      'Equinos': 'Equinos',
      'Saúde e performance': 'Salud y rendimiento',
      'Ovinos': 'Ovinos',
      'Nutrição balanceada': 'Nutrición balanceada',
      'Suínos': 'Porcinos',
      'Sanidade e ganho': 'Sanidad y ganancia',
      'Aves': 'Aves',
      'Saúde avícola': 'Salud avícola',
      'Mineralização': 'Mineralización',

      'Produtos em destaque': 'Productos destacados',
      'Destaques para': 'Destacados para',
      'comprar agora': 'comprar ahora',
      'Produtos Champion de alta procura, com aplicação prática no campo e compra rápida pelo carrinho.': 'Productos Champion de alta demanda, de aplicación práctica en el campo y compra rápida por el carrito.',
      'Ver todos': 'Ver todos',
      'Mais vendido': 'Más vendido',
      'Tripla ação': 'Triple acción',
      'Ação ampla': 'Acción amplia',

      'no agro': 'en el agro',
      '3 gerações': '3 generaciones',
      'de evolução': 'de evolución',
      'Presença nacional': 'Presencia nacional',
      'Em todo o Brasil': 'En todo Brasil',
      'Tecnologia própria': 'Tecnología propia',
      'Inovação contínua': 'Innovación continua',
      'Reconhecimento no agro': 'Reconocimiento en el agro',
      'Prêmios que comprovam': 'Premios que lo comprueban',
      'Compromisso de verdade': 'Compromiso de verdad',
      'Com pecuaristas e o futuro': 'Con los ganaderos y el futuro',
      'Nossa história': 'Nuestra historia',
      'Mais de': 'Más de',
      '67 anos': '67 años',
      'transformando a': 'transformando la',
      'pecuária brasileira.': 'ganadería brasileña.',
      'Com sede em': 'Con sede en',
      ', a Champion desenvolve soluções para a pecuária com mais de 67 anos, unindo tradição, ciência e compromisso com resultados reais no campo.': ', Champion desarrolla soluciones para la ganadería desde hace más de 67 años, uniendo tradición, ciencia y compromiso con resultados reales en el campo.',
      'Nossas tecnologias aumentam a': 'Nuestras tecnologías aumentan la',
      'produtividade': 'productividad',
      'reduzem custos': 'reducen costos',
      'e elevam o': 'y elevan el',
      'desempenho do rebanho': 'rendimiento del rebaño',
      ', gerando mais rentabilidade para o produtor rural.': ', generando más rentabilidad para el productor rural.',
      'Reconhecimento que comprova nossa trajetória': 'Reconocimiento que comprueba nuestra trayectoria',
      '4× eleita a melhor empresa de produtos veterinários do Brasil': '4× elegida la mejor empresa de productos veterinarios de Brasil',
      'Destaque no setor agropecuário': 'Destacada en el sector agropecuario',
      'Uma das Melhores Empresas para Você Trabalhar': 'Una de las Mejores Empresas para Trabajar',
      'A Champion é assim:': 'Champion es así:',
      'Cresce com o pecuarista': 'Crece junto al ganadero',
      'Produz com qualidade': 'Produce con calidad',
      'Sem resíduos, com bem-estar': 'Sin residuos, con bienestar',
      'Menor custo total no mercado': 'Menor costo total del mercado',
      'Ver soluções para o seu rebanho': 'Ver soluciones para tu rebaño',
      'Assistir institucional': 'Ver el institucional',
      'Compromisso com o pecuarista. Sempre.': 'Compromiso con el ganadero. Siempre.',
      'anos de mercado': 'años en el mercado',
      '"A Champion entende o pecuarista. Produto que funciona, suporte que aparece."': '"Champion entiende al ganadero. Producto que funciona, soporte que aparece."',
      '— Pecuarista parceiro · Goiás': '— Ganadero asociado · Goiás',

      'Por que Champion': 'Por qué Champion',
      'Mais que produtos:': 'Más que productos:',
      'resultado real': 'resultado real',
      'no campo.': 'en el campo.',
      'A maior pecuária comercial do mundo confia na Champion há': 'La mayor ganadería comercial del mundo confía en Champion desde hace',
      'mais de 67 anos': 'más de 67 años',
      '6 motivos': '6 motivos',
      'que fazem do nosso portfólio referência nacional em saúde e nutrição animal.': 'que hacen de nuestro portafolio una referencia nacional en salud y nutrición animal.',
      'Garantia Champion': 'Garantía Champion',
      'Mais de 67 anos comprovando eficácia. Se não funcionar, a gente resolve.': 'Más de 67 años comprobando eficacia. Si no funciona, lo resolvemos.',
      'Frete para todo Brasil': 'Envío a todo Brasil',
      'Entregamos em todo o território nacional. Acima de R$ 500, o frete é por nossa conta.': 'Entregamos en todo el territorio nacional. Por encima de R$ 500, el envío corre por nuestra cuenta.',
      'Suporte técnico': 'Soporte técnico',
      'Veterinários e zootecnistas prontos para indicar a melhor solução para o seu rebanho.': 'Veterinarios y zootecnistas listos para indicar la mejor solución para tu rebaño.',
      'Pagamento seguro': 'Pago seguro',
      'Pix, boleto e cartão em até 6× sem juros. Compra protegida com criptografia SSL.': 'Pix, boleto y tarjeta hasta en 6× sin intereses. Compra protegida con cifrado SSL.',
      'Atendimento direto': 'Atención directa',
      'Fale com o time pelo WhatsApp. Dúvidas sobre dose, aplicação ou compra, sem burocracia.': 'Habla con el equipo por WhatsApp. Dudas sobre dosis, aplicación o compra, sin burocracia.',
      'Sem resíduos': 'Sin residuos',
      'Linha desenvolvida sem deixar resíduos no leite e carne. Respeito ao bem-estar animal.': 'Línea desarrollada sin dejar residuos en la leche ni en la carne. Respeto al bienestar animal.',
      'Tradição e confiança': 'Tradición y confianza',
      '+67 anos ao lado do pecuarista brasileiro.': '+67 años junto al ganadero brasileño.',
      'Pesquisa, desenvolvimento e inovação constantes.': 'Investigación, desarrollo e innovación constantes.',
      'Atendemos milhares de produtores em todo o Brasil.': 'Atendemos a miles de productores en todo Brasil.',
      'Compromisso com o agro': 'Compromiso con el agro',
      'Soluções que geram produtividade com responsabilidade.': 'Soluciones que generan productividad con responsabilidad.',

      'Revenda Champion': 'Distribuidores Champion',
      'Venda Champion na': 'Vende Champion en',
      'sua região': 'tu región',
      'Portfólio completo de saúde e nutrição animal, suporte técnico e uma marca com mais de 67 anos de estrada no agro brasileiro. Acesse o portal da revenda e fale com a fábrica.': 'Portafolio completo de salud y nutrición animal, soporte técnico y una marca con más de 67 años de trayectoria en el agro brasileño. Accede al portal de distribuidores y habla con la fábrica.',
      'Acessar a revenda': 'Acceder al portal',

      'Pecuaristas falam': 'Los ganaderos hablan',
      'A confiança de quem': 'La confianza de quien',
      'vive do campo': 'vive del campo',
      'Depoimentos reais de produtores rurais que escolhem Champion para cuidar do rebanho.': 'Testimonios reales de productores rurales que eligen Champion para cuidar su rebaño.',
      '"A linha Difly mudou nossa rotina. Reduziu 80% das moscas-dos-chifres e o gado ganhou peso muito mais rápido."': '"La línea Difly cambió nuestra rutina. Redujo el 80% de las moscas de los cuernos y el ganado ganó peso mucho más rápido."',
      'Pecuarista · Goiás (1.200 cabeças)': 'Ganadero · Goiás (1.200 cabezas)',
      '"Comprei VER-MI-SAL pelo site, recebi em 4 dias. Custo-benefício imbatível, e o suporte técnico é excelente."': '"Compré VER-MI-SAL por el sitio y lo recibí en 4 días. Relación costo-beneficio inmejorable, y el soporte técnico es excelente."',
      'Cria e recria · Mato Grosso (850 cabeças)': 'Cría y recría · Mato Grosso (850 cabezas)',
      '"Trabalho com Champion há 25 anos. Confiança e qualidade que não tem em outra marca. Recomendo de olhos fechados."': '"Trabajo con Champion desde hace 25 años. Confianza y calidad que no hay en otra marca. La recomiendo con los ojos cerrados."',
      'Confinamento · Minas Gerais (3.200 cabeças)': 'Engorde · Minas Gerais (3.200 cabezas)',

      'Um legado que': 'Un legado que',
      'contempla três gerações': 'abarca tres generaciones',
      'Assistir história Champion': 'Ver la historia de Champion',
      'Conheça a tradição, a tecnologia e o compromisso por trás das soluções para o campo.': 'Conoce la tradición, la tecnología y el compromiso detrás de las soluciones para el campo.',

      'Representantes': 'Representantes',
      'Estamos em': 'Estamos en',
      'todo o Brasil': 'todo Brasil',
      'Encontre um representante mais perto de você ou fale com nosso time de atendimento. Trabalhamos com a maior pecuária comercial do mundo — todos os dias.': 'Encuentra un representante cerca de ti o habla con nuestro equipo de atención. Trabajamos con la mayor ganadería comercial del mundo — todos los días.',
      'Onde encontrar': 'Dónde encontrarnos',
      'Fale conosco': 'Contáctanos',
      'Quero ser contatado': 'Quiero que me contacten',
      'Seu nome': 'Tu nombre',
      'Seu e-mail': 'Tu correo',
      'Seu telefone': 'Tu teléfono',
      'Sua mensagem': 'Tu mensaje',
      'Enviar mensagem': 'Enviar mensaje',

      'Empresa genuinamente brasileira com mais de 67 anos entrega resultados reais para a maior pecuária comercial do mundo.': 'Empresa genuinamente brasileña con más de 67 años entrega resultados reales a la mayor ganadería comercial del mundo.',
      'Empresa': 'Empresa',
      'Navegação': 'Navegación',
      'Missão e Valores': 'Misión y valores',
      'Jeito Champion': 'El estilo Champion',
      'Trabalhe Conosco': 'Trabaja con nosotros',
      'Contato': 'Contacto',
      '© 2026 Champion Farmoquímico Ltda. — CNPJ 37.866.100/0001-05. Todos os direitos reservados.': '© 2026 Champion Farmoquímico Ltda. — CNPJ 37.866.100/0001-05. Todos los derechos reservados.',
      '© 2026 Champion Farmoquímico Ltda. Todos os direitos reservados.': '© 2026 Champion Farmoquímico Ltda. Todos los derechos reservados.',
      'Política de Privacidade': 'Política de privacidad',
      'Termos de uso': 'Términos de uso',

      'Seu carrinho': 'Tu carrito',
      'Seu carrinho está vazio.': 'Tu carrito está vacío.',
      'Que tal adicionar um produto?': '¿Qué tal agregar un producto?',
      'Total': 'Total',
      'Finalizar pedido': 'Finalizar pedido',
      'Adicionado ao carrinho': 'Agregado al carrito',

      'Nossos produtos': 'Nuestros productos',
      'Todos os produtos': 'Todos los productos',
      'Conheça a Champion': 'Conoce Champion',
      'Sobre a Champion': 'Sobre Champion',
      'Blog Champion': 'Blog Champion',
      'Página Inicial': 'Inicio'
    }
  };

  /* Conteúdo que NÃO deve ser traduzido no navegador.

     Produto vem do Shopify e post vem do Firestore, ambos em português. O
     widget do chat tem tradução própria (chat-widget.js) e o agente responde
     no idioma da pergunta. Traduzir aqui atropelaria os dois. */
  const IGNORAR = [
    'script', 'style', 'noscript', 'textarea', 'code', 'pre',
    '#championChat', '.chat-modal',
    '.product-grid', '.product-card', '.detail-info', '.detail-art',
    '.blog-grid', '.blog-article-content', '.blog-featured',
    '[data-no-i18n]'
  ].join(',');

  /* Texto original de cada nó, capturado na primeira passada. Sem isso não há
     como voltar para o português — a tradução seria só de ida. */
  const originais = new WeakMap();

  function traduzivel(no) {
    if (!no.nodeValue || !no.nodeValue.trim()) return false;
    const pai = no.parentElement;
    return Boolean(pai) && !pai.closest(IGNORAR);
  }

  function aplicar(lang) {
    const dic = DICIONARIO[lang];
    const voltandoAoOriginal = !dic;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (no) {
        return traduzivel(no) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let no;
    while ((no = walker.nextNode())) {
      if (!originais.has(no)) originais.set(no, no.nodeValue);
      const original = originais.get(no);

      if (voltandoAoOriginal) {
        if (no.nodeValue !== original) no.nodeValue = original;
        continue;
      }

      const traduzido = dic[original.trim()];
      if (!traduzido) {
        /* Sem tradução, fica em português. Melhor que texto faltando. */
        if (no.nodeValue !== original) no.nodeValue = original;
        continue;
      }

      /* Preserva os espaços em volta, senão as palavras grudam quando o texto
         está no meio de uma frase com tags ("Mais de <em>67 anos</em>"). */
      no.nodeValue = original.match(/^\s*/)[0] + traduzido + original.match(/\s*$/)[0];
    }

    /* Placeholder não é nó de texto — precisa de passada própria. */
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function (campo) {
      if (campo.closest(IGNORAR)) return;
      if (!campo.dataset.phOriginal) campo.dataset.phOriginal = campo.placeholder;
      const base = campo.dataset.phOriginal;
      campo.placeholder = (dic && dic[base.trim()]) || base;
    });
  }

  window.ChampionI18n = {
    apply: aplicar,
    /* Acrescentar tradução sem editar este arquivo. */
    extend: function (lang, pares) {
      DICIONARIO[lang] = Object.assign(DICIONARIO[lang] || {}, pares || {});
    },
    /* Quantas strings existem por idioma — serve para medir cobertura. */
    size: function (lang) {
      return Object.keys(DICIONARIO[lang] || {}).length;
    }
  };
})();
