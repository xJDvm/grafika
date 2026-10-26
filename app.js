const app = document.querySelector('#app');
const navItems = [...document.querySelectorAll('[data-nav]')];
const searchOverlay = document.querySelector('.search-overlay');
const globalSearchInput = document.querySelector('#global-search-input');

let catalog = { categories: [], articles: [] };
let glossary = { terms: [] };
const articleCache = new Map();
const articleSearchText = new Map();

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function inlineMarkdown(value) {
  let text = escapeHTML(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safe = /^(https?:|mailto:|\/|#|content\/)/i.test(url) ? url : '#';
    return `<a href="${escapeHTML(safe)}">${label}</a>`;
  });
  return text;
}

function markdownToHTML(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  const headings = [];
  const usedHeadingIds = new Set();
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) { flushParagraph(); continue; }
    const heading = line.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const title = heading[2].trim();
      const baseId = slugify(title) || 'seccion';
      let id = baseId;
      let suffix = 2;
      while (usedHeadingIds.has(id)) id = `${baseId}-${suffix++}`;
      usedHeadingIds.add(id);
      headings.push({ id, title, level });
      html.push(`<h${level} id="${id}">${inlineMarkdown(title)}</h${level}>`);
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      flushParagraph();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells);
        i += 1;
      }
      i -= 1;
      if (rows.length) {
        const [header, ...body] = rows;
        html.push(`<div class="table-scroll"><table><thead><tr>${header.map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${header.map((_, index) => `<td>${inlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`), i += 1;
      i -= 1;
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`), i += 1;
      i -= 1;
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      html.push(`<blockquote><p>${inlineMarkdown(line.replace(/^>\s?/, ''))}</p></blockquote>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return { html: html.join('\n'), headings };
}

const categoryById = (id) => catalog.categories.find((item) => item.id === id);
const articlesFor = (id) => catalog.articles.filter((item) => item.category === id);

function artBlock(kind = 'home') {
  if (kind === 'tutoriales') {
    return `<div class="graphic graphic-tutoriales" aria-hidden="true"><span class="graphic-dot"></span><div class="mosaic"><i class="mosaic-purple"></i><i class="mosaic-sky"></i><i class="mosaic-pink"></i><i class="mosaic-spinner"></i><i class="mosaic-yellow"></i><i class="mosaic-green"></i><i class="mosaic-orange"></i></div></div>`;
  }
  if (kind === 'info') {
    return `<div class="graphic graphic-info" aria-hidden="true"><span class="graphic-dot"></span><div class="mosaic"><i class="mosaic-mint"></i><i class="mosaic-orange"></i><i class="mosaic-purple"><b class="spinner"></b></i><i class="mosaic-spinner"></i><i class="mosaic-sky"></i></div></div>`;
  }
  if (kind === 'support') {
    return `<div class="graphic graphic-support" aria-hidden="true"><div class="mosaic"><i class="mosaic-mint"></i><i class="mosaic-orange"></i><i class="mosaic-yellow"></i><i class="mosaic-green"></i><i class="mosaic-purple"></i><i class="mosaic-sky"></i></div><span class="question-tile">?</span></div>`;
  }
  return `<div class="graphic graphic-home" aria-hidden="true"><span class="graphic-dot"></span><div class="mosaic"><i class="mosaic-purple"><b class="spinner"></b></i><i class="mosaic-sky"></i><i class="mosaic-pink"></i><i class="mosaic-mint"></i><i class="mosaic-pink"><b class="green-dot"></b></i><i class="mosaic-orange"></i></div></div>`;
}

function renderHome() {
  return `<section class="page page-home" aria-labelledby="home-title">
    <div class="hero home-hero">
      <div class="hero-copy">
        <p class="hero-kicker">Hola, bienvenido a</p>
        <h1 id="home-title" class="hero-wordmark">GRAF!KA</h1>
        <p class="hero-description">Tu espacio de orientación académica para la carrera de Artes Mención Diseño Gráfico. Explora las clases, consulta guías y encuentra recursos para cada etapa.</p>
        <form class="hero-search" role="search" data-search-form><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9"/><path d="m20.5 20.5 7 7"/></svg><input name="q" type="search" placeholder="Buscar información, temas, recursos..." aria-label="Buscar información, temas y recursos" /><button type="submit" aria-label="Buscar">Buscar</button></form>
        <div class="hero-actions"><a class="button button-primary hero-cta" href="#tutoriales">Explorar clases <span aria-hidden="true">→</span></a><a class="button button-ghost" href="#info">Conoce Grafika</a></div>
      </div>
      ${artBlock('home')}
    </div>
    <section class="home-resources" aria-label="Accesos a recursos">
      <a class="resource-card resource-featured resource-explore" href="#tutoriales"><span class="resource-icon" aria-hidden="true">${categoryIcon('illustrator')}</span><strong>Explorar clases</strong><span class="resource-copy">Entra al catálogo completo de las ocho clases de Diseño Gráfico y abre sus guías disponibles.</span><span class="resource-arrow">Ver catálogo&nbsp; →</span></a>
      <a class="resource-card resource-orange resource-glossary" href="#glosario" aria-label="Abrir glosario académico"><span class="resource-icon" aria-hidden="true">${categoryIcon('book-open-text')}</span><strong>Glosario académico</strong><span class="resource-copy">Consulta conceptos de diseño, tipografía, color e impresión.</span><span class="resource-arrow"><span class="resource-arrow-label">Consultar glosario</span><span aria-hidden="true">→</span></span></a>
      <a class="resource-card resource-purple" href="#categoria/illustrator"><span class="resource-icon" aria-hidden="true">${categoryIcon('illustrator')}</span><strong>Guías de Illustrator</strong><span class="resource-copy">Fundamentos y aspectos básicos para empezar con el diseño vectorial.</span><span class="resource-arrow">→</span></a>
      <a class="resource-card resource-blue" href="#info"><span class="resource-icon" aria-hidden="true">${categoryIcon('chat')}</span><strong>¿Qué es Grafika?</strong><span class="resource-copy">Conoce el propósito de esta plataforma académica y cómo puede acompañarte.</span><span class="resource-arrow">→</span></a>
    </section>
  </section>`;
}

function renderInfo() {
  const values = [
    ['shield', 'Información confiable', 'Contenido académico revisado y mantenido al día para tu carrera.'],
    ['book', 'Recursos prácticos', 'Guías claras y organizadas por clase para estudiar paso a paso.'],
    ['tools', 'Herramientas digitales', 'Tutoriales de las herramientas que usarás en Diseño Gráfico.'],
    ['chat', 'Orientación cercana', 'Un acompañamiento que te ayuda a avanzar en cada etapa.']
  ];
  return `<section class="page page-info" aria-labelledby="info-title">
    <div class="hero info-hero"><div class="hero-copy"><p class="hero-kicker" id="info-title">¿Qué es</p><h1 class="hero-wordmark">GRAF!KA<span>?</span></h1><p class="hero-description">Una plataforma web académica creada para orientar y acompañar a los estudiantes de Artes Mención Diseño Gráfico de la Universidad Arturo Michelena.</p></div>${artBlock('info')}</div>
    <section class="purpose-section"><div class="purpose-intro"><h2>Nuestro propósito</h2><p>Brindar un espacio accesible, organizado y amigable que conecte a los estudiantes con la información de su carrera.</p></div><div class="purpose-callout"><span class="target-icon" aria-hidden="true">${categoryIcon('target')}</span><p>Más que información, es una guía para tu trayectoria en la carrera.</p></div><div class="value-grid">${values.map(([icon, title, body]) => `<article class="value-card"><span class="value-icon value-${icon}" aria-hidden="true">${categoryIcon(icon)}</span><div class="value-text"><strong class="value-title">${title}</strong><strong class="value-body">${body}</strong></div></article>`).join('')}</div></section>
  </section>`;
}

function renderGlossary(initialQuery = '') {
  const letters = [...new Set(glossary.terms.map((item) => item.term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()[0]))].sort();
  return `<section class="page simple-page glossary-page" aria-labelledby="glossary-title">
    <div class="simple-heading"><a class="back-link" href="#inicio">← Volver al inicio</a><p class="article-label">Recursos académicos</p><h1 id="glossary-title">Glosario académico</h1><p>Encuentra definiciones de conceptos usados en Diseño Gráfico.</p></div>
    <div class="glossary-tools"><label class="glossary-search"><span class="sr-only">Buscar un término</span><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9"/><path d="m20.5 20.5 7 7"/></svg><input type="search" id="glossary-search" value="${escapeHTML(initialQuery)}" placeholder="Buscar término o definición…" autocomplete="off"></label><p class="glossary-count" aria-live="polite"><strong id="glossary-count">${glossary.terms.length}</strong> términos</p></div>
    <nav class="glossary-letters" aria-label="Filtrar por letra"><button class="glossary-letter is-active" type="button" data-glossary-letter="">Todas</button>${letters.map((letter) => `<button class="glossary-letter" type="button" data-glossary-letter="${letter}">${letter}</button>`).join('')}</nav>
    <div class="glossary-grid">${glossary.terms.map((item) => { const letter = item.term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()[0]; return `<article class="glossary-card" data-glossary-card data-letter="${letter}" data-search="${escapeHTML(`${item.term} ${item.definition}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())}"><span class="glossary-term-letter" aria-hidden="true">${letter}</span><h2>${escapeHTML(item.term)}</h2><p>${escapeHTML(item.definition)}</p></article>`; }).join('')}</div>
    <p class="glossary-empty" hidden>No encontramos términos con esa búsqueda. Prueba con otra palabra o letra.</p>
  </section>`;
}

function categoryCard(category) {
  const count = articlesFor(category.id).length;
  const icon = categoryIcon(category.id);
  return `<a class="tutorial-card color-${escapeHTML(category.color)}" href="#categoria/${encodeURIComponent(category.id)}" data-search="${escapeHTML(`${category.title} ${category.subtitle}`.toLowerCase())}"><span class="tutorial-swatch" aria-hidden="true">${icon}</span><span class="tutorial-title">${escapeHTML(category.title)}</span>${category.subtitle ? `<span class="tutorial-subtitle">${escapeHTML(category.subtitle)}</span>` : ''}<span class="tutorial-arrow" aria-hidden="true">→</span><span class="sr-only">${count ? `${count} artículos disponibles` : 'Sin artículos publicados todavía'}</span></a>`;
}

function categoryIcon(id) {
  const icons = {
    illustrator: 'pen-tool', tipografia: 'type', color: 'palette', impresion: 'printer',
    'identidad-visual': 'fingerprint', ilustracion: 'paintbrush', editorial: 'book-open', packaging: 'package',
    shield: 'shield-check', book: 'book-open-text', 'book-open-text': 'book-open-text', tools: 'wrench', chat: 'message-circle', target: 'target'
  };
  const name = icons[id] || 'circle-help';
  return `<span class="lucide-icon" style="--lucide-icon:url('assets/icons/${name}.svg')" aria-hidden="true"></span>`;
}

function renderTutorials() {
  return `<section class="page page-tutorials" aria-labelledby="tutorial-title"><div class="hero tutorials-hero"><div class="hero-copy"><p class="hero-kicker">Aprende, practica y</p><h1 class="hero-wordmark">GRAF!KA</h1><p class="hero-description">Explora las ocho clases de Diseño Gráfico.</p></div>${artBlock('tutoriales')}</div><section class="tutorial-directory" aria-label="Clases de Diseño Gráfico"><div class="tutorial-grid">${catalog.categories.map(categoryCard).join('')}</div></section></section>`;
}

function renderCategory(categoryId) {
  const category = categoryById(categoryId);
  if (!category) return renderNotFound();
  const articles = articlesFor(categoryId);
  const content = articles.length
    ? `<div class="article-card-grid">${articles.map((article) => `<a class="article-card" href="#articulo/${encodeURIComponent(article.slug)}"><span class="article-label">${escapeHTML(article.label)}</span><h2>${escapeHTML(article.title)}</h2><p>${escapeHTML(article.summary)}</p><span class="article-meta">Abrir clase <span>→</span></span></a>`).join('')}</div>`
    : `<div class="empty-state"><span class="empty-mark" aria-hidden="true">✦</span><h2>Material pendiente</h2><p>Aún no hay contenido cargado para la clase de ${escapeHTML(category.title)}.</p><a class="button button-primary" href="#tutoriales">Volver a las clases</a></div>`;
  return `<section class="page simple-page"><div class="simple-heading"><a class="back-link" href="#tutoriales">← Volver a tutoriales</a><p class="article-label">Clase</p><h1>${escapeHTML(category.title)}</h1>${category.subtitle ? `<p>${escapeHTML(category.subtitle)}</p>` : ''}</div>${content}</section>`;
}

async function loadArticle(article) {
  if (articleCache.has(article.slug)) return articleCache.get(article.slug);
  const path = `content/${article.file.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${article.title}`);
  const value = await response.text();
  articleCache.set(article.slug, value);
  return value;
}

async function renderArticle(slug) {
  const article = catalog.articles.find((item) => item.slug === slug);
  if (!article) return renderNotFound();
  let markdown;
  try { markdown = await loadArticle(article); }
  catch { return `<section class="page simple-page"><div class="empty-state"><h1>No pudimos abrir esta guía</h1><p>Comprueba tu conexión y vuelve a intentarlo.</p><button class="button button-primary" data-retry-article="${escapeHTML(slug)}">Reintentar</button></div></section>`; }
  const rendered = markdownToHTML(markdown);
  const category = categoryById(article.category);
  const toc = rendered.headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escapeHTML(heading.id)}" data-section-target="${escapeHTML(heading.id)}">${escapeHTML(heading.title)}</a></li>`).join('');
  const related = articlesFor(article.category).filter((item) => item.slug !== article.slug);
  return `<section class="page article-page" aria-labelledby="article-title">
    <div class="article-heading"><div class="article-heading-top"><a class="back-link" href="#categoria/${encodeURIComponent(article.category)}">← Volver a ${escapeHTML(category?.title || 'tutoriales')}</a><span class="article-label">${escapeHTML(article.label)}</span></div><h1 id="article-title">${escapeHTML(article.title)}</h1><p class="article-subtitle">${escapeHTML(article.subtitle)}</p><p class="article-summary">${escapeHTML(article.summary)}</p><div class="article-meta"><span>${escapeHTML(article.source || `Material de referencia · páginas ${article.sourcePages}`)}</span></div></div>
    <div class="article-layout">
      <aside class="article-sidebar article-toc"><a class="back-link toc-back" href="#categoria/${encodeURIComponent(article.category)}">← Volver a ${escapeHTML(category?.title || 'la clase')}</a><h2>Contenido</h2><details class="toc-disclosure" open><summary>Contenido de la guía</summary><ol class="toc-list">${toc}</ol></details></aside>
      <article class="article-content">${rendered.html}${article.sourceNote ? `<p class="source-note">${escapeHTML(article.sourceNote)}</p>` : ''}</article>
      <aside class="article-sidebar related-sidebar"><h2>Temas relacionados</h2>${related.map((item) => `<a class="related-link" href="#articulo/${encodeURIComponent(item.slug)}">${escapeHTML(item.title)} <span>→</span></a>`).join('') || '<p>Explora más temas y guías desde Tutoriales.</p>'}<a class="related-more" href="#tutoriales">Navega también por todas las categorías →</a></aside>
    </div>
  </section>`;
}

function renderSupport() {
  const questions = [
    ['¿Quiénes pueden utilizar Grafika?', 'Grafika está pensada para estudiantes de Artes Mención Diseño Gráfico de la Universidad Arturo Michelena.'],
    ['¿Cómo puedo encontrar la información que necesito?', 'Usa la búsqueda del inicio o explora las categorías de Tutoriales para encontrar guías y recursos.'],
    ['¿Hay contenidos para estudiantes que están comenzando la carrera?', 'Sí. Las guías están organizadas por temas y puedes comenzar por los fundamentos de Adobe Illustrator.'],
    ['¿Qué hago si no encuentro un tema o recurso?', 'Escríbenos al correo de soporte y cuéntanos qué información necesitas.']
  ];
  return `<section class="page page-support" aria-labelledby="support-title"><div class="hero support-hero"><div class="hero-copy"><h1 id="support-title" class="support-wordmark">¿Necesitas<br /><span>ayuda?</span></h1><p class="hero-description">Estamos aquí para apoyarte. Encuentra respuesta a tus dudas o contáctanos directamente.</p></div>${artBlock('support')}</div><section class="support-content">
    <section class="support-group faq-group" aria-labelledby="faq-title"><h2 id="faq-title">Preguntas frecuentes</h2><div class="faq-list">${questions.map(([q,a]) => `<details class="faq-item"><summary>${escapeHTML(q)}<span class="faq-mark" aria-hidden="true">+</span></summary><div class="faq-panel"><p>${escapeHTML(a)}</p></div></details>`).join('')}</div></section>
    <aside class="support-group contact-group" aria-labelledby="contact-title"><h2 id="contact-title">Contáctanos</h2>
      <div class="contact-prompt"><h3>¿No encuentras lo que buscas?</h3><p>Escríbenos y te ayudaremos a encontrar la información que necesitas.</p><a class="button button-primary" href="mailto:grafikauam@gmail.com?subject=Consulta%20sobre%20Grafika">Escribir un correo</a></div>
      <div class="contact-card"><span class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span><div class="contact-detail"><strong>Correo</strong><a href="mailto:grafikauam@gmail.com">grafikauam@gmail.com</a></div></div>
      <div class="contact-card"><span class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 5c0-1 1-2 2-2z"/></svg></span><div class="contact-detail"><strong>Redes sociales</strong><div class="social-links" aria-label="Redes sociales"><a class="social instagram" href="#soporte" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg></a><a class="social facebook" href="#soporte" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V7c0-.8.2-1.2 1.3-1.2H17V3h-2.6C11.7 3 10.5 4.4 10.5 6.8V8.5H8.5v3h2v8.5h3.5V11.5h2.4l.4-3H14z"/></svg></a><a class="social tiktok" href="#soporte" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3h3c.2 2.2 1.4 3.6 3 4v3.1a8.2 8.2 0 0 1-4-1.4v6.2a6.1 6.1 0 1 1-6.1-6.1c.4 0 .8 0 1.1.1v3.3a2.8 2.8 0 1 0 1.3 2.4V3z"/></svg></a></div></div></div>
    </aside>
  </section></section>`;
}

function normalizeSearch(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
    .replace(/[-‐‑‒–—]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function editDistanceWithin(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    let smallest = row;
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1));
      smallest = Math.min(smallest, current[column]);
    }
    if (smallest > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

function matchScore(query, text, allowTypos = true) {
  const normalizedQuery = normalizeSearch(query);
  const normalizedText = normalizeSearch(text);
  if (!normalizedQuery || !normalizedText) return 0;
  if (normalizedText.includes(normalizedQuery)) return 100;
  // Une palabras separadas por espacios para igualar variantes como
  // "hi-res", "hi res" y "hires" sin perder la búsqueda por frase.
  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const compactText = normalizedText.replace(/\s+/g, '');
  if (compactQuery.length >= 3 && compactText.includes(compactQuery)) return 92;
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const textWords = normalizedText.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const queryWord of queryWords) {
    let best = 0;
    for (const word of textWords) {
      if (word === queryWord) best = Math.max(best, 30);
      else if (word.startsWith(queryWord)) best = Math.max(best, 22);
      else if (allowTypos && Math.min(word.length, queryWord.length) >= 4) {
        const typoLimit = queryWord.length >= 10 ? 2 : 1;
        const distance = editDistanceWithin(queryWord, word, typoLimit);
        if (distance <= typoLimit) best = Math.max(best, 16 - distance * 3);
      }
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

function renderSearch(query) {
  const matches = catalog.articles.map((article) => {
    const metadata = `${article.title} ${article.subtitle} ${article.summary} ${article.label} ${(article.tags || []).join(' ')}`;
    const corpus = articleSearchText.get(article.slug) || metadata;
    const score = Math.max(matchScore(query, metadata), matchScore(query, corpus, false));
    return { article, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  const articles = matches.map((entry) => entry.article);
  const categories = catalog.categories.filter((category) => {
    const relatedText = articlesFor(category.id).map((article) => articleSearchText.get(article.slug) || `${article.title} ${article.summary}`).join(' ');
    return Math.max(matchScore(query, `${category.title} ${category.subtitle}`), matchScore(query, relatedText, false)) > 0;
  });
  const terms = glossary.terms.map((term) => ({ term, score: matchScore(query, `${term.term} ${term.definition}`) }))
    .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return `<section class="page simple-page search-results-page"><div class="simple-heading"><p class="article-label">Búsqueda</p><h1>Resultados para “${escapeHTML(query)}”</h1></div>
    ${terms.length ? `<section class="search-result-group glossary-result-group" aria-labelledby="glossary-results-title"><div class="search-group-heading"><span class="search-group-icon">${categoryIcon('book-open-text')}</span><div><p class="search-group-kicker">Glosario académico</p><h2 id="glossary-results-title">Términos relacionados <span>${terms.length}</span></h2></div><a href="#glosario">Ver glosario completo →</a></div><div class="glossary-results-grid">${terms.map(({term}) => `<a class="glossary-result-card" href="#glosario/${encodeURIComponent(term.term)}"><span class="glossary-result-label">Término del glosario</span><h3>${escapeHTML(term.term)}</h3><p>${escapeHTML(term.definition)}</p><span class="glossary-result-link">Ver término en el glosario <span aria-hidden="true">→</span></span></a>`).join('')}</div></section>` : ''}
    ${articles.length ? `<section class="search-result-group" aria-labelledby="article-results-title"><h2 class="results-subheading" id="article-results-title">Artículos y guías <span>${articles.length}</span></h2><div class="article-card-grid">${articles.map((article) => `<a class="article-card" href="#articulo/${encodeURIComponent(article.slug)}"><span class="article-label">${escapeHTML(article.label)}</span><h2>${escapeHTML(article.title)}</h2><p>${escapeHTML(article.summary)}</p><span class="article-meta">Abrir artículo <span>→</span></span></a>`).join('')}</div></section>` : ''}
    ${categories.length ? `<section class="search-result-group" aria-labelledby="class-results-title"><h2 class="results-subheading" id="class-results-title">Clases <span>${categories.length}</span></h2><div class="tutorial-grid">${categories.map(categoryCard).join('')}</div></section>` : ''}
    ${!terms.length && !articles.length && !categories.length ? `<div class="empty-state"><h2>No encontramos resultados</h2><p>Prueba con otro término o explora el glosario y las clases.</p><a class="button button-primary" href="#glosario">Abrir glosario</a><a class="button button-ghost-dark" href="#tutoriales">Ver clases</a></div>` : ''}</section>`;
}

function renderNotFound() {
  return `<section class="page error-page"><div class="error-copy"><p class="error-code">404</p><h1>Página no encontrada</h1><p>La página que buscas no existe o fue movida a otro lugar.</p><a class="button button-primary" href="#inicio">Volver al inicio <span>→</span></a></div>${artBlock('info')}</section>`;
}

function renderOffline() {
  return `<section class="page error-page offline-page"><div class="error-copy"><p class="error-code">Sin conexión</p><h1>No hay conexión a internet</h1><p>Revisa tu conexión. Las páginas y guías guardadas en este dispositivo volverán a estar disponibles al cargar de nuevo.</p><button class="button button-primary" type="button" data-retry-online>Reintentar <span>↻</span></button></div>${artBlock('info')}</section>`;
}

function routeFromHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw || raw === 'home') return ['inicio'];
  const [route, ...rest] = raw.split('/');
  const arg = rest.join('/');
  if (route === 'inicio' || route === 'info' || route === 'tutoriales' || route === 'soporte') return [route];
  if (route === 'glosario') return ['glosario', decodeURIComponent(arg || '')];
  if (route === 'categoria') return ['categoria', decodeURIComponent(arg)];
  if (route === 'articulo') return ['articulo', decodeURIComponent(arg)];
  if (route === 'buscar') return ['buscar', decodeURIComponent(arg || '')];
  if (route === 'offline') return ['offline'];
  return ['404'];
}

function setActiveNav(route) {
  const active = ['categoria', 'articulo'].includes(route) ? 'tutoriales' : route;
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.nav === active));
}

async function renderRoute() {
  if (!navigator.onLine && !articleCache.size && !catalog.articles.length) {
    app.innerHTML = renderOffline();
    app.setAttribute('aria-busy', 'false');
    return;
  }
  const [route, argument] = routeFromHash();
  setActiveNav(route);
  if (typeof closeMenu === 'function') closeMenu();
  app.setAttribute('aria-busy', 'true');
  try {
    if (route === 'inicio') app.innerHTML = renderHome();
    else if (route === 'info') app.innerHTML = renderInfo();
    else if (route === 'tutoriales') app.innerHTML = renderTutorials();
    else if (route === 'soporte') app.innerHTML = renderSupport();
    else if (route === 'glosario') {
      glossaryLetter = '';
      app.innerHTML = renderGlossary(argument || '');
      document.querySelectorAll('[data-glossary-letter]').forEach((button) => button.classList.toggle('is-active', button.dataset.glossaryLetter === ''));
      filterGlossary();
    }
    else if (route === 'categoria') app.innerHTML = renderCategory(argument);
    else if (route === 'articulo') app.innerHTML = await renderArticle(argument);
    else if (route === 'buscar') app.innerHTML = renderSearch(argument);
    else if (route === 'offline') app.innerHTML = renderOffline();
    else app.innerHTML = renderNotFound();
  } catch {
    app.innerHTML = `<section class="page simple-page"><div class="empty-state"><h1>No pudimos cargar el contenido</h1><p>Vuelve a intentarlo en unos segundos.</p><button class="button button-primary" data-retry>Reintentar</button></div></section>`;
  }
  app.setAttribute('aria-busy', 'false');
  if (route !== 'buscar') window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function start() {
  try {
    const response = await fetch('content/catalog.json');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    catalog = await response.json();
    const glossaryResponse = await fetch('content/glossary.json');
    if (!glossaryResponse.ok) throw new Error('No se pudo cargar el glosario');
    glossary = await glossaryResponse.json();
  } catch {
    app.innerHTML = navigator.onLine
      ? `<section class="page simple-page"><div class="empty-state"><h1>Grafika no pudo cargar el catálogo</h1><p>Comprueba la conexión y vuelve a intentarlo.</p><button class="button button-primary" data-retry>Reintentar</button></div></section>`
      : renderOffline();
    app.setAttribute('aria-busy', 'false');
    return;
  }
  await Promise.all(catalog.articles.map(async (article) => {
    try {
      const markdown = await loadArticle(article);
      articleSearchText.set(article.slug, markdown);
    } catch { /* La búsqueda conserva el índice de metadatos si un artículo está fuera de línea. */ }
  }));
  await renderRoute();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('offline', () => { location.hash = '#offline'; });
window.addEventListener('online', () => { if (routeFromHash()[0] === 'offline') location.hash = '#inicio'; });

function closeMenu() { /* El menú compacto se reemplazó por una navegación inline deslizable. */ }

document.querySelector('.search-toggle').addEventListener('click', () => {
  searchOverlay.hidden = false;
  globalSearchInput.focus();
});
document.querySelector('.close-search').addEventListener('click', () => { searchOverlay.hidden = true; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') searchOverlay.hidden = true; });
document.querySelector('.global-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = globalSearchInput.value.trim();
  if (query) location.hash = `#buscar/${encodeURIComponent(query)}`;
  searchOverlay.hidden = true;
});
document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-search-form]');
  if (!form) return;
  event.preventDefault();
  const query = new FormData(form).get('q')?.toString().trim();
  if (query) location.hash = `#buscar/${encodeURIComponent(query)}`;
});
document.addEventListener('input', (event) => {
  if (event.target.id !== 'glossary-search') return;
  filterGlossary();
});
let glossaryLetter = '';
function filterGlossary() {
  const query = (document.querySelector('#glossary-search')?.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let visible = 0;
  document.querySelectorAll('[data-glossary-card]').forEach((card) => {
    const show = (!glossaryLetter || card.dataset.letter === glossaryLetter) && (!query || card.dataset.search.includes(query));
    card.hidden = !show;
    if (show) visible += 1;
  });
  const count = document.querySelector('#glossary-count');
  if (count) count.textContent = visible;
  const empty = document.querySelector('.glossary-empty');
  if (empty) empty.hidden = visible !== 0;
}
document.addEventListener('click', (event) => {
  const letterButton = event.target.closest('[data-glossary-letter]');
  if (letterButton) {
    glossaryLetter = letterButton.dataset.glossaryLetter;
    document.querySelectorAll('[data-glossary-letter]').forEach((button) => button.classList.toggle('is-active', button === letterButton));
    filterGlossary();
  }
  const sectionLink = event.target.closest('[data-section-target]');
  if (sectionLink) {
    event.preventDefault();
    document.getElementById(sectionLink.dataset.sectionTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (event.target.closest('[data-retry]')) start();
  if (event.target.closest('[data-retry-online]')) location.reload();
  const retry = event.target.closest('[data-retry-article]');
  if (retry) renderRoute();
});

start();
