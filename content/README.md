# Contenido editorial

La interfaz y los artículos están separados. El catálogo `catalog.json` contiene metadatos de categorías y artículos; cada artículo vive en su propio archivo Markdown dentro de `articles/`.

Para añadir material, crea un archivo Markdown, agrega una entrada al arreglo `articles` del catálogo y define su categoría. La web genera la lista, los enlaces y el índice del artículo al cargar el catálogo. También indexa el texto Markdown para la búsqueda. No hace falta editar componentes ni instalar un CMS.

El catálogo muestra las ocho clases definidas para Grafika: Illustrator, Tipografía, Color, Impresión, Identidad visual, Ilustración, Editorial y Packaging. Solo se publican materiales que ya tienen una fuente: las dos lecciones de Illustrator provienen del PDF compartido y Fundamentos de la identidad visual proviene del documento Word. Las demás clases permanecen visibles sin artículos hasta que se agregue su material. No se generan guías de contenido sin una fuente.

Para publicar una clase nueva, agrega su archivo Markdown en `articles/` y una entrada en `content/catalog.json`, dentro de una de las ocho categorías existentes.
