const app = document.querySelector('#app');
const navItems = [...document.querySelectorAll('[data-nav]')];
const searchOverlay = document.querySelector('.search-overlay');
const globalSearchInput = document.querySelector('#global-search-input');

let catalog = { categories: [], articles: [] };
let glossary = { terms: [] };
const videoTutorials = [
  { title: 'Adobe Illustrator · Tutorial 1', category: 'Adobe Illustrator', id: 'gfOjG5-yyic', url: 'https://youtu.be/gfOjG5-yyic?si=rjULbFEjW4MGLnhA' },
  { title: 'Adobe Illustrator · Tutorial 2', category: 'Adobe Illustrator', id: 'sekxanyTmGM', url: 'https://youtu.be/sekxanyTmGM?si=ihH-XXyWl9QZf-1V' },
  { title: 'Adobe Illustrator · Tutorial 3', category: 'Adobe Illustrator', id: 'pHLA7RhERxg', url: 'https://youtu.be/pHLA7RhERxg?si=Jn4HLZ1HbZrtIbde' },
  { title: 'Adobe Illustrator · Tutorial 4', category: 'Adobe Illustrator', id: 'NJLxoI1CdOs', url: 'https://youtu.be/NJLxoI1CdOs?si=yItf_Ipcepd9wSOu' },
  { title: 'Cómo diseñar un cartel publicitario', category: 'Diseño de carteles', id: 'at31lfnHUCQ', url: 'https://youtu.be/at31lfnHUCQ?si=2Md2p6o9EobbIooc' },
  { title: 'Cómo usar Photoshop · Tutorial 1', category: 'Photoshop', id: 'FB4DdUfvfwM', url: 'https://youtu.be/FB4DdUfvfwM?si=959YwK_Qugv1CrTy' },
  { title: 'Cómo usar Photoshop · Tutorial 2', category: 'Photoshop', id: 'ynM5LAKv86M', url: 'https://youtu.be/ynM5LAKv86M?si=wkcdqneUffGW0T26' },
  { title: 'InDesign desde cero', category: 'InDesign', id: 'sQumLDEC7zY', url: 'https://youtu.be/sQumLDEC7zY?si=CwqYaQNvRs_wSiEJ' }
];
const articleCache = new Map();
const articleSearchText = new Map();

const ui = (name) => `<span class="lucide-icon ui-icon" style="--lucide-icon:url('assets/icons/${name}.svg')" aria-hidden="true"></span>`;

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
        <div class="hero-actions"><a class="button button-primary hero-cta" href="#clases">Explorar clases ${ui('arrow-right')}</a><a class="button button-ghost" href="#info">Conoce Grafika</a></div>
      </div>
      ${artBlock('home')}
    </div>
    <section class="home-resources" aria-label="Accesos a recursos">
      <a class="resource-card resource-featured resource-explore" href="#clases"><span class="resource-icon" aria-hidden="true">${categoryIcon('illustrator')}</span><strong>Explorar clases</strong><span class="resource-copy">Entra al catálogo completo de las ocho clases de Diseño Gráfico y abre sus guías disponibles.</span><span class="resource-arrow"><span class="resource-arrow-label">Ver catálogo</span><span class="resource-arrow-icon" aria-hidden="true">${ui('arrow-right')}</span></span></a>
      <a class="resource-card resource-orange resource-glossary" href="#glosario" aria-label="Abrir glosario académico"><span class="resource-icon" aria-hidden="true">${categoryIcon('book-open-text')}</span><strong>Glosario académico</strong><span class="resource-copy">Consulta conceptos de diseño, tipografía, color e impresión.</span><span class="resource-arrow"><span class="resource-arrow-label">Consultar glosario</span><span class="resource-arrow-icon" aria-hidden="true">${ui('arrow-right')}</span></span></a>
      <a class="resource-card resource-purple resource-tutorials" href="#tutoriales"><span class="resource-icon" aria-hidden="true">${categoryIcon('video')}</span><strong>Tutoriales en video</strong><span class="resource-copy">Videos de Illustrator, Photoshop, InDesign y diseño de carteles.</span><span class="resource-arrow"><span class="resource-arrow-label">Ver tutoriales</span><span class="resource-arrow-icon" aria-hidden="true">${ui('arrow-right')}</span></span></a>
      <a class="resource-card resource-blue resource-info" href="#info"><span class="resource-icon" aria-hidden="true">${categoryIcon('chat')}</span><strong>¿Qué es Grafika?</strong><span class="resource-copy">Conoce el propósito de esta plataforma académica y cómo puede acompañarte.</span><span class="resource-arrow"><span class="resource-arrow-label">Conocer Grafika</span><span class="resource-arrow-icon" aria-hidden="true">${ui('arrow-right')}</span></span></a>
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
    ${renderInfoJump()}
    <section class="purpose-section"><div class="purpose-intro"><h2 id="purpose-title">Nuestro propósito</h2><p>Brindar un espacio accesible, organizado y amigable que conecte a los estudiantes con la información de su carrera.</p></div><div class="purpose-callout"><span class="target-icon" aria-hidden="true">${categoryIcon('target')}</span><p>Más que información, es una guía para tu trayectoria en la carrera.</p></div><div class="value-grid">${values.map(([icon, title, body]) => `<article class="value-card"><span class="value-icon value-${icon}" aria-hidden="true">${categoryIcon(icon)}</span><div class="value-text"><strong class="value-title">${title}</strong><strong class="value-body">${body}</strong></div></article>`).join('')}</div></section>
    ${renderSupportContent()}
  </section>`;
}

function renderGlossary(initialQuery = '') {
  const letters = [...new Set(glossary.terms.map((item) => item.term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()[0]))].sort();
  return `<section class="page simple-page glossary-page" aria-labelledby="glossary-title">
    <div class="simple-heading"><a class="back-link" href="#inicio">${ui('arrow-left')}Volver al inicio</a><p class="article-label">Recursos académicos</p><h1 id="glossary-title">Glosario académico</h1><p>Encuentra definiciones de conceptos usados en Diseño Gráfico.</p></div>
    <div class="glossary-tools"><label class="glossary-search"><span class="sr-only">Buscar un término</span><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9"/><path d="m20.5 20.5 7 7"/></svg><input type="search" id="glossary-search" value="${escapeHTML(initialQuery)}" placeholder="Buscar término o definición…" autocomplete="off"></label><p class="glossary-count" aria-live="polite"><strong id="glossary-count">${glossary.terms.length}</strong> términos</p></div>
    <nav class="glossary-letters" aria-label="Filtrar por letra"><button class="glossary-letter is-active" type="button" data-glossary-letter="">Todas</button>${letters.map((letter) => `<button class="glossary-letter" type="button" data-glossary-letter="${letter}">${letter}</button>`).join('')}</nav>
    <div class="glossary-grid">${glossary.terms.map((item) => { const letter = item.term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()[0]; return `<article class="glossary-card" data-glossary-card data-letter="${letter}" data-search="${escapeHTML(`${item.term} ${item.definition}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())}"><span class="glossary-term-letter" aria-hidden="true">${letter}</span><h2>${escapeHTML(item.term)}</h2><p>${escapeHTML(item.definition)}</p></article>`; }).join('')}</div>
    <p class="glossary-empty" hidden>No encontramos términos con esa búsqueda. Prueba con otra palabra o letra.</p>
  </section>`;
}

function categoryCard(category) {
  const count = articlesFor(category.id).length;
  const icon = categoryIcon(category.id);
  return `<a class="tutorial-card color-${escapeHTML(category.color)}" href="#categoria/${encodeURIComponent(category.id)}" data-search="${escapeHTML(`${category.title} ${category.subtitle}`.toLowerCase())}"><span class="tutorial-swatch" aria-hidden="true">${icon}</span><span class="tutorial-title">${escapeHTML(category.title)}</span>${category.subtitle ? `<span class="tutorial-subtitle">${escapeHTML(category.subtitle)}</span>` : ''}<span class="tutorial-arrow" aria-hidden="true">${ui('arrow-right')}</span><span class="sr-only">${count ? `${count} artículos disponibles` : 'Sin artículos publicados todavía'}</span></a>`;
}

function categoryIcon(id) {
  const icons = {
    illustrator: 'pen-tool', tipografia: 'type', color: 'palette', impresion: 'printer', video: 'circle-play',
    'identidad-visual': 'fingerprint', ilustracion: 'paintbrush', editorial: 'book-open', packaging: 'package',
    shield: 'shield-check', book: 'book-open-text', 'book-open-text': 'book-open-text', tools: 'wrench', chat: 'message-circle', target: 'target'
  };
  const name = icons[id] || 'circle-help';
  return `<span class="lucide-icon" style="--lucide-icon:url('assets/icons/${name}.svg')" aria-hidden="true"></span>`;
}

function renderClasses() {
  return `<section class="page page-tutorials" aria-labelledby="classes-title"><div class="hero tutorials-hero"><div class="hero-copy"><p class="hero-kicker">Aprende, practica y</p><h1 id="classes-title" class="hero-wordmark">Clases</h1><p class="hero-description">Explora las ocho clases de Diseño Gráfico y abre sus guías disponibles.</p></div>${artBlock('tutoriales')}</div><section class="tutorial-directory" aria-label="Clases de Diseño Gráfico"><div class="tutorial-grid">${catalog.categories.map(categoryCard).join('')}</div></section></section>`;
}

function renderVideoTutorials() {
  const groups = [...new Set(videoTutorials.map((video) => video.category))];
  return `<section class="page page-video-tutorials" aria-labelledby="video-tutorials-title"><div class="hero tutorials-hero"><div class="hero-copy"><p class="hero-kicker">Aprende a tu ritmo</p><h1 id="video-tutorials-title" class="hero-wordmark">Tutoriales</h1><p class="hero-description">Videos prácticos de herramientas y temas de Diseño Gráfico.</p></div>${artBlock('tutoriales')}</div><div class="video-tutorial-directory">${groups.map((group) => `<section class="video-tutorial-group" aria-labelledby="${slugify(group)}-title"><div class="video-group-heading"><span>${categoryIcon(group === 'Diseño de carteles' ? 'palette' : 'video')}</span><h2 id="${slugify(group)}-title">${escapeHTML(group)}</h2></div><div class="video-tutorial-grid">${videoTutorials.filter((video) => video.category === group).map(videoTutorialCard).join('')}</div></section>`).join('')}</div></section>`;
}

function videoTutorialCard(video) {
  return `<article class="video-tutorial-card"><div class="video-thumbnail"><img src="https://img.youtube.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg" alt="Miniatura de ${escapeHTML(video.title)}" loading="lazy"></div><div class="video-tutorial-details"><p class="video-category-label">${escapeHTML(video.category)}</p><h3>${escapeHTML(video.title)}</h3><div class="video-tutorial-actions"><a class="button button-primary" href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">Ver en YouTube ${ui('arrow-up-right')}</a><button class="button button-copy" type="button" data-copy-link="${escapeHTML(video.url)}" aria-live="polite">Copiar enlace</button></div></div></article>`;
}

function guideArt() {
  return `<div class="guide-art" aria-hidden="true"><span class="ga-sun"><i></i></span><span class="ga-purple"><i></i><b></b></span><span class="ga-sky"><i></i></span></div>`;
}

function renderCategory(categoryId) {
  const category = categoryById(categoryId);
  if (!category) return renderNotFound();
  const articles = articlesFor(categoryId);
  const content = articles.length
    ? `<div class="article-card-grid">${articles.map((article) => `<a class="article-card" href="#articulo/${encodeURIComponent(article.slug)}"><span class="article-label">${escapeHTML(article.label)}</span><h2>${escapeHTML(article.title)}</h2><p>${escapeHTML(article.summary)}</p><span class="article-meta">Abrir clase ${ui('arrow-right')}</span></a>`).join('')}</div>`
    : `<div class="empty-state"><span class="empty-mark" aria-hidden="true">${ui('sparkles')}</span><h2>Material pendiente</h2><p>Aún no hay contenido cargado para la clase de ${escapeHTML(category.title)}.</p><a class="button button-primary" href="#clases">Volver a las clases</a></div>`;
  return `<section class="page category-page" aria-labelledby="category-title">
    <header class="guide-hero category-hero">${guideArt()}<div class="guide-hero-copy"><a class="back-link" href="#clases">${ui('arrow-left')}Volver a clases</a><span class="article-label">Clase</span><h1 id="category-title">${escapeHTML(category.title)}</h1>${category.subtitle ? `<p class="article-subtitle">${escapeHTML(category.subtitle)}</p>` : ''}</div></header>
    <div class="category-body">${content}</div>
  </section>`;
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
  catch { return renderError('No pudimos abrir esta guía', 'Comprueba tu conexión y vuelve a intentarlo.', `data-retry-article="${escapeHTML(slug)}"`); }
  const rendered = markdownToHTML(markdown);
  const category = categoryById(article.category);
  const categoryHref = `#categoria/${encodeURIComponent(article.category)}`;
  const toc = rendered.headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escapeHTML(heading.id)}" data-section-target="${escapeHTML(heading.id)}">${escapeHTML(heading.title)}</a></li>`).join('');
  const related = articlesFor(article.category).filter((item) => item.slug !== article.slug);
  const relatedLinks = related.map((item) => `<a class="related-link" href="#articulo/${encodeURIComponent(item.slug)}"><span class="related-dot" aria-hidden="true"></span><span>${escapeHTML(item.title)}</span>${ui('arrow-right')}</a>`).join('') || '<p class="related-empty">Explora más temas y guías desde Clases.</p>';
  return `<section class="page guide" aria-labelledby="article-title">
    <aside class="guide-nav" aria-label="Contenido de la guía">
      <a class="back-link toc-back" href="${categoryHref}">${ui('arrow-left')}Volver</a>
      <a class="guide-class" href="${categoryHref}"><span class="guide-class-icon" aria-hidden="true">${categoryIcon(article.category)}</span><span>${escapeHTML(category?.title || 'Clase')}</span></a>
      <details class="toc-disclosure" open><summary>Contenido de la guía</summary><ol class="toc-list">${toc}</ol></details>
      <span class="guide-nav-deco" aria-hidden="true"></span>
    </aside>
    <div class="guide-main">
      <header class="guide-hero">${guideArt()}<div class="guide-hero-copy"><span class="article-label">${escapeHTML(article.label)}</span><h1 id="article-title">${escapeHTML(article.title)}</h1><p class="article-subtitle">${escapeHTML(article.subtitle)}</p><p class="article-summary">${escapeHTML(article.summary)}</p><p class="guide-meta">${escapeHTML(article.source || `Material de referencia · páginas ${article.sourcePages}`)}</p></div></header>
      <div class="guide-body">
        <article class="article-content">${rendered.html}${article.sourceNote ? `<p class="source-note">${escapeHTML(article.sourceNote)}</p>` : ''}</article>
        <aside class="guide-related" aria-label="Más contenido">
          <section class="related-card"><h2>${ui('link')}Temas relacionados</h2>${relatedLinks}</section>
          <section class="related-card"><h2>${ui('compass')}Navega también</h2>
            <a class="related-link" href="#clases"><span class="related-dot" aria-hidden="true"></span><span>Todas las clases</span>${ui('arrow-right')}</a>
            <a class="related-link" href="#glosario"><span class="related-dot" aria-hidden="true"></span><span>Glosario académico</span>${ui('arrow-right')}</a>
            <a class="related-link" href="#tutoriales"><span class="related-dot" aria-hidden="true"></span><span>Tutoriales en video</span>${ui('arrow-right')}</a>
          </section>
        </aside>
      </div>
    </div>
  </section>`;
}

function renderInfoJump() {
  return `<nav class="info-jump" aria-label="Secciones de esta página"><a href="#info" data-section-target="purpose-title">${ui('target')}Propósito</a><a href="#info" data-section-target="start-title">${ui('compass')}Cómo empezar</a><a href="#info" data-section-target="faq-title">${ui('circle-help')}Preguntas</a><a href="#info" data-section-target="contact-title">${ui('message-circle')}Contacto</a></nav>`;
}

function renderSupportContent() {
  const questions = [
    ['¿Quiénes pueden utilizar Grafika?', 'Grafika está pensada para estudiantes de Artes Mención Diseño Gráfico de la Universidad Arturo Michelena.'],
    ['¿Cómo puedo encontrar la información que necesito?', 'Usa la búsqueda del inicio o explora las secciones de Clases, Tutoriales y Glosario.'],
    ['¿Hay contenidos para estudiantes que están comenzando la carrera?', 'Sí. Las guías están organizadas por temas y puedes comenzar por los fundamentos de Adobe Illustrator.'],
    ['¿Qué hago si no encuentro un tema o recurso?', 'Escríbenos y cuéntanos qué información necesitas para que podamos orientarte.']
  ];
  const steps = [
    ['1', 'Explora las clases', 'Abre una clase y recorre sus guías paso a paso.', '#clases', 'purple'],
    ['2', 'Consulta el glosario', 'Resuelve dudas de conceptos con definiciones claras.', '#glosario', 'orange'],
    ['3', 'Mira los tutoriales', 'Refuerza lo aprendido con videos prácticos.', '#tutoriales', 'blue']
  ];
  const socials = [
    ['instagram', 'Instagram', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>'],
    ['facebook', 'Facebook', '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21.5v-8h2.7l.5-3.3h-3.2V8.1c0-.95.4-1.7 1.8-1.7h1.5V3.5c-.3 0-1.2-.2-2.3-.2-2.6 0-4.3 1.6-4.3 4.4v2.5H7.5v3.3h2.7v8z"/></svg>'],
    ['tiktok', 'TikTok', '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><path id="tt" d="M16.6 3.2h-3.1v11.9a2.5 2.5 0 1 1-2.5-2.5c.3 0 .6 0 .8.1V9.5a5.7 5.7 0 1 0 4.8 5.6V9.2a7.5 7.5 0 0 0 4.2 1.3V7.4a4.4 4.4 0 0 1-4.2-4.2z"/></defs><use href="#tt" x="-.7" y="-.5" fill="#25f4ee"/><use href="#tt" x=".7" y=".5" fill="#fe2c55"/><use href="#tt" fill="#fff"/></svg>']
  ];
  return `<section class="start-section" aria-labelledby="start-title"><h2 id="start-title">Empieza en tres pasos</h2><div class="start-grid">${steps.map(([n, title, body, href, color]) => `<a class="start-card start-${color}" href="${href}"><span class="start-number" aria-hidden="true">${n}</span><span class="start-text"><strong>${title}</strong><span>${body}</span></span>${ui('arrow-right')}</a>`).join('')}</div></section>
  <section class="help-grid" aria-label="Ayuda y contacto">
    <div class="help-faq" aria-labelledby="faq-title"><h2 id="faq-title">Preguntas frecuentes</h2><div class="faq-list">${questions.map(([q, a], index) => `<details class="faq-item"${index === 0 ? ' open' : ''}><summary>${escapeHTML(q)}<span class="faq-mark" aria-hidden="true">${ui('plus')}</span></summary><div class="faq-panel"><p>${escapeHTML(a)}</p></div></details>`).join('')}</div></div>
    <aside class="help-contact" aria-labelledby="contact-title"><h2 id="contact-title">Contacto y redes</h2>
      <div class="contact-panel"><span class="contact-panel-icon" aria-hidden="true">${ui('message-circle')}</span><h3>¿No encuentras lo que buscas?</h3><p>Escríbenos y te ayudaremos a encontrar la información que necesitas.</p><a class="button button-cta" href="mailto:grafikauam@gmail.com?subject=Consulta%20sobre%20Grafika">${ui('mail')}Escribir un correo</a><a class="contact-mail" href="mailto:grafikauam@gmail.com">grafikauam@gmail.com</a>
        <div class="contact-divider" role="presentation"></div><p class="contact-social-title">Síguenos en redes</p>
        <div class="social-links" aria-label="Redes sociales">${socials.map(([id, name, svg]) => `<a class="social-link" href="#info" aria-label="${name}"><span class="social ${id}">${svg}</span><span>${name}</span></a>`).join('')}</div>
      </div>
    </aside>
  </section>`;
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
  const videos = videoTutorials.map((video) => ({ video, score: matchScore(query, `${video.title} ${video.category}`) }))
    .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return `<section class="page simple-page search-results-page"><div class="simple-heading"><p class="article-label">Búsqueda</p><h1>Resultados para “${escapeHTML(query)}”</h1></div>
    ${terms.length ? `<section class="search-result-group glossary-result-group" aria-labelledby="glossary-results-title"><div class="search-group-heading"><span class="search-group-icon">${categoryIcon('book-open-text')}</span><div><p class="search-group-kicker">Glosario académico</p><h2 id="glossary-results-title">Términos relacionados <span>${terms.length}</span></h2></div><a href="#glosario">Ver glosario completo ${ui('arrow-right')}</a></div><div class="glossary-results-grid">${terms.map(({term}) => `<a class="glossary-result-card" href="#glosario/${encodeURIComponent(term.term)}"><span class="glossary-result-label">Término del glosario</span><h3>${escapeHTML(term.term)}</h3><p>${escapeHTML(term.definition)}</p><span class="glossary-result-link">Ver término en el glosario ${ui('arrow-right')}</span></a>`).join('')}</div></section>` : ''}
    ${videos.length ? `<section class="search-result-group video-search-results" aria-labelledby="video-results-title"><h2 class="results-subheading" id="video-results-title">Tutoriales en video <span>${videos.length}</span></h2><div class="video-tutorial-grid">${videos.map(({video}) => videoTutorialCard(video)).join('')}</div></section>` : ''}
    ${articles.length ? `<section class="search-result-group" aria-labelledby="article-results-title"><h2 class="results-subheading" id="article-results-title">Artículos y guías <span>${articles.length}</span></h2><div class="article-card-grid">${articles.map((article) => `<a class="article-card" href="#articulo/${encodeURIComponent(article.slug)}"><span class="article-label">${escapeHTML(article.label)}</span><h2>${escapeHTML(article.title)}</h2><p>${escapeHTML(article.summary)}</p><span class="article-meta">Abrir artículo ${ui('arrow-right')}</span></a>`).join('')}</div></section>` : ''}
    ${categories.length ? `<section class="search-result-group" aria-labelledby="class-results-title"><h2 class="results-subheading" id="class-results-title">Clases <span>${categories.length}</span></h2><div class="tutorial-grid">${categories.map(categoryCard).join('')}</div></section>` : ''}
    ${!terms.length && !videos.length && !articles.length && !categories.length ? `<div class="empty-state"><h2>No encontramos resultados</h2><p>Prueba con otro término o explora el glosario y las clases.</p><div class="empty-actions"><a class="button button-primary" href="#glosario">Abrir glosario</a><a class="button button-ghost-dark" href="#clases">Ver clases</a></div></div>` : ''}</section>`;
}

function errorArt() {
  return `<div class="error-strip" aria-hidden="true"><span class="es-ring"></span><i class="es-t1"></i><i class="es-t2"></i><i class="es-t3"></i><i class="es-t4"></i><i class="es-t5"></i><i class="es-t6"></i></div>`;
}

function renderError(title = 'Ocurrió un problema', body = 'Estamos teniendo problemas para cargar el contenido. Por favor, inténtalo de nuevo en unos minutos.', retryAttr = 'data-retry') {
  const illustration = `<svg class="error-illus" viewBox="0 0 120 100" aria-hidden="true"><rect x="10" y="8" width="100" height="84" rx="18" fill="#d4e3ea"/><path d="M10 26a18 18 0 0 1 18-18h32v30H10z" fill="#b7d6e7"/><path d="M60 8h32a18 18 0 0 1 18 18v12H60z" fill="#7bb8dc"/><circle cx="29" cy="23" r="4" fill="#df0751"/><circle cx="43" cy="23" r="4" fill="#4f5fea"/><circle cx="57" cy="23" r="4" fill="#00b050"/><rect x="38" y="52" width="6" height="14" rx="3" fill="#012f63"/><rect x="76" y="52" width="6" height="14" rx="3" fill="#012f63"/><path d="M50 78q10-9 20 0" fill="none" stroke="#012f63" stroke-width="5" stroke-linecap="round"/></svg>`;
  return `<section class="page error-page"><div class="error-copy">${illustration}<h1>${title}</h1><p>${body}</p><div class="error-actions"><button class="button button-primary" type="button" ${retryAttr}>Reintentar ${ui('rotate-cw')}</button><a class="button button-ghost-dark" href="#inicio">Volver al inicio</a></div></div>${errorArt()}</section>`;
}

function renderNotFound() {
  return `<section class="page error-page"><div class="error-copy"><p class="error-code" aria-label="Error 404">4<span class="error-zero" aria-hidden="true"></span>4</p><h1>Página no encontrada</h1><p>La página que buscas no existe o fue movida a otro lugar.</p><div class="error-actions"><a class="button button-primary" href="#inicio">Volver al inicio ${ui('arrow-right')}</a><a class="button button-ghost-dark" href="#clases">Ver clases</a></div></div>${errorArt()}</section>`;
}

function renderOffline() {
  const illustration = `<svg class="error-illus error-illus-wifi" viewBox="0 0 120 100" aria-hidden="true"><g fill="none" stroke="#012f63" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 42a64 64 0 0 1 92 0"/><path d="M30 58a40 40 0 0 1 60 0"/><path d="M46 73a17 17 0 0 1 28 0"/><path d="M20 10l80 82"/></g><circle cx="60" cy="87" r="6" fill="#012f63"/><g stroke-width="5" stroke-linecap="round"><path d="M98 14l-3 8" stroke="#85cba4"/><path d="M110 24l-8 5" stroke="#4285f4"/><path d="M114 40l-8 0" stroke="#fc742a"/></g></svg>`;
  return `<section class="page error-page offline-page"><div class="error-copy">${illustration}<h1>Sin conexión a internet</h1><p>Parece que no tienes conexión. Revisa tu red e inténtalo de nuevo; las guías guardadas en este dispositivo volverán a estar disponibles.</p><div class="error-actions"><button class="button button-primary" type="button" data-retry-online>Reintentar ${ui('rotate-cw')}</button></div></div>${errorArt()}</section>`;
}

function routeFromHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw || raw === 'home') return ['inicio'];
  const [route, ...rest] = raw.split('/');
  const arg = rest.join('/');
  if (route === 'inicio' || route === 'info' || route === 'tutoriales' || route === 'clases') return [route];
  if (route === 'soporte') return ['info'];
  if (route === 'glosario') return ['glosario', decodeURIComponent(arg || '')];
  if (route === 'categoria') return ['categoria', decodeURIComponent(arg)];
  if (route === 'articulo') return ['articulo', decodeURIComponent(arg)];
  if (route === 'buscar') return ['buscar', decodeURIComponent(arg || '')];
  if (route === 'offline') return ['offline'];
  return ['404'];
}

function setActiveNav(route) {
  const active = ['categoria', 'articulo'].includes(route) ? 'clases' : route;
  navItems.forEach((item) => {
    const isActive = item.dataset.nav === active;
    item.classList.toggle('is-active', isActive);
    if (isActive) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
}

const guideDesktop = window.matchMedia('(min-width: 1000px)');
guideDesktop.addEventListener('change', (event) => {
  const disclosure = document.querySelector('.guide-nav .toc-disclosure');
  if (disclosure) disclosure.open = event.matches;
});
let guideObserver = null;
function setupGuide() {
  guideObserver?.disconnect();
  guideObserver = null;
  const disclosure = document.querySelector('.guide-nav .toc-disclosure');
  if (disclosure) disclosure.open = guideDesktop.matches;
  const links = [...document.querySelectorAll('.guide-nav [data-section-target]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((link) => [link.dataset.sectionTarget, link]));
  guideObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach((link) => link.removeAttribute('aria-current'));
    byId.get(visible.target.id)?.setAttribute('aria-current', 'true');
  }, { rootMargin: '0px 0px -70% 0px' });
  byId.forEach((_, id) => { const heading = document.getElementById(id); if (heading) guideObserver.observe(heading); });
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
    else if (route === 'tutoriales') app.innerHTML = renderVideoTutorials();
    else if (route === 'clases') app.innerHTML = renderClasses();
    else if (route === 'glosario') {
      glossaryLetter = '';
      app.innerHTML = renderGlossary(argument || '');
      document.querySelectorAll('[data-glossary-letter]').forEach((button) => button.classList.toggle('is-active', button.dataset.glossaryLetter === ''));
      filterGlossary();
    }
    else if (route === 'categoria') app.innerHTML = renderCategory(argument);
    else if (route === 'articulo') { app.innerHTML = await renderArticle(argument); setupGuide(); }
    else if (route === 'buscar') app.innerHTML = renderSearch(argument);
    else if (route === 'offline') app.innerHTML = renderOffline();
    else app.innerHTML = renderNotFound();
  } catch {
    app.innerHTML = renderError();
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
      ? renderError('Grafika no pudo cargar el catálogo', 'Comprueba la conexión y vuelve a intentarlo.')
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

const navScrollControls = [...document.querySelectorAll('[data-nav-scroll]')];
function updateNavScrollControls() {
  const navigation = document.querySelector('#main-nav');
  if (!navigation) return;
  const hasOverflow = navigation.scrollWidth > navigation.clientWidth + 2;
  const atStart = navigation.scrollLeft <= 1;
  const atEnd = navigation.scrollLeft + navigation.clientWidth >= navigation.scrollWidth - 1;
  navScrollControls.forEach((button) => {
    const isLeft = button.dataset.navScroll === 'left';
    button.hidden = !hasOverflow || (isLeft ? atStart : atEnd);
  });
}
document.querySelector('#main-nav')?.addEventListener('scroll', updateNavScrollControls, { passive: true });
window.addEventListener('resize', updateNavScrollControls);
navScrollControls.forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#main-nav')?.scrollBy({ left: button.dataset.navScroll === 'left' ? -160 : 160, behavior: 'smooth' });
}));
requestAnimationFrame(updateNavScrollControls);

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
  const copyButton = event.target.closest('[data-copy-link]');
  if (copyButton) {
    event.preventDefault();
    const link = copyButton.dataset.copyLink;
    const originalText = 'Copiar enlace';
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const input = document.createElement('textarea');
        input.value = link;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      copyButton.textContent = '¡Enlace copiado!';
      window.setTimeout(() => { copyButton.textContent = originalText; }, 1800);
    };
    copyToClipboard();
    return;
  }
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
