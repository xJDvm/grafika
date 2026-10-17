# Grafika

Sitio estático en español para publicar orientación académica y recursos de Diseño Gráfico. No requiere instalar dependencias ni un CMS.

## Ejecutar localmente

Desde esta carpeta, inicia un servidor estático, por ejemplo:

```sh
python3 -m http.server 4173
```

Abre `http://localhost:4173`. Para detenerlo, vuelve a la terminal y presiona `Ctrl+C`.

## Añadir artículos

1. Crea un archivo `.md` dentro de `content/articles/`.
2. Añade sus datos al arreglo `articles` de `content/catalog.json` (título, resumen, categoría, archivo y etiquetas).
3. Asocia el material a una de las ocho clases existentes; no añadas materias nuevas sin confirmación.

La interfaz genera de ese catálogo las tarjetas, los enlaces, la página de lectura, el índice lateral y los temas relacionados. Los artículos admiten encabezados, listas, tablas, citas y código. El contenido vive separado del HTML y el CSS. La búsqueda crea un índice del catálogo y de los artículos Markdown al cargar el sitio; admite tildes, fragmentos y errores comunes de escritura.

La cuadrícula de categorías y tarjetas usa columnas `auto-fit` con ancho mínimo; gana o pierde columnas según el espacio disponible. El texto del artículo fluye en altura natural, con columnas laterales que se apilan en móvil. El service worker guarda el catálogo y los artículos para permitir volver a leerlos sin conexión; cuando hay internet, refresca los archivos editoriales.

La interfaz usa iconos SVG de Lucide guardados localmente en `assets/icons/`, con su licencia ISC. Así se mantienen disponibles sin depender de un CDN.

## Material incorporado

El PDF compartido aportó dos lecciones de Illustrator: fundamentos (páginas 1–4) y aspectos básicos (páginas 5–16). El Word compartido aportó la clase de Identidad visual. El catálogo solo incluye esas ocho clases: Illustrator, Tipografía, Color, Impresión, Identidad visual, Ilustración, Editorial y Packaging. Las otras seis aparecen sin artículos hasta recibir su material.
