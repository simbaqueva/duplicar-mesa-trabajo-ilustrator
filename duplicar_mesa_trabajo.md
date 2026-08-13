# Script: duplicar_mesa_trabajo.jsx

## ¿Qué hace este script?

Es un **script de Adobe Illustrator** (ExtendScript, extensión `.jsx`) que **duplica una mesa de trabajo (artboard)** y copia **solo los objetos que están dentro de esa mesa** a la nueva mesa creada.

### Funcionalidades principales:
1. **Pide al usuario** qué número de mesa de trabajo quiere copiar (con un cuadro de diálogo `prompt`).
2. **Lee las coordenadas** de la mesa seleccionada.
3. **Crea una mesa nueva** a la derecha de la más lejana (con un espacio de 120 pt), o si no cabe, la coloca en una **fila nueva debajo**.
4. **Copia los objetos** de la mesa original a la nueva, manteniendo su posición relativa.
5. **Pregunta si quiere convertir los textos a curvas** (outlines) en la copia.
6. Coloca los objetos copiados en una **capa nueva** llamada "Duplicado 1", "Duplicado 2", etc.

### Corrección de errores incluida (FIX):
- Valida el **límite del lienzo de Illustrator** (~227 pulgadas / 16383 pt desde el origen 0,0) antes de crear la mesa nueva, para evitar el error `1095724867 ('AOoC')`.
- Si no hay espacio a la derecha, salta automáticamente a una fila nueva debajo en lugar de intentar salirse del área de trabajo.

---

## ¿Para qué programa es?

Es para **Adobe Illustrator** (versiones de escritorio para Windows o macOS). Usa el motor de scripting **ExtendScript** (basado en JavaScript/ECMAScript 3), que es el lenguaje nativo de automatización de Illustrator.

---

## Requisitos previos

1. **Adobe Illustrator instalado** (cualquier versión reciente, CC o CS6+).
2. **Un documento abierto** en Illustrator con al menos una mesa de trabajo. Si no hay documento abierto, el script muestra el mensaje: *"Abra un documento en Illustrator antes de ejecutar el script."*
3. **Permisos de scripting habilitados** (opcional según versión): en Illustrator, ve a *Edición → Preferencias → General* y activa *"Permitir ejecución de scripts"* si te lo pide.

---

## ¿Cómo ejecutarlo?

Hay varias formas:

**Opción 1 – Menú de Illustrator:**
1. Abre tu documento en Illustrator.
2. Ve a **Archivo → Scripts → Otro script...** (File → Scripts → Other Script...).
3. Selecciona el archivo `duplicar_mesa_trabajo.jsx`.
4. Sigue las indicaciones en pantalla.

**Opción 2 – Arrastrar y soltar:**
- Arrastra el archivo `.jsx` directamente sobre la ventana de Illustrator.

**Opción 3 – Panel de Scripts (recomendado para uso frecuente):**
- Coloca el archivo en la carpeta de scripts de Illustrator:
  - **Windows:** `C:\Program Files\Adobe\Adobe Illustrator [versión]\Presets\es_ES\Scripts\`
  - **macOS:** `/Applications/Adobe Illustrator [versión]/Presets/es_ES/Scripts/`
- Luego aparecerá en **Archivo → Scripts** y podrás ejecutarlo con un clic.

---

## ¿Cómo funciona? (flujo interno)

1. **Verifica** que haya un documento abierto (`app.documents.length`).
2. **Pide el número de mesa** a copiar y valida que sea válido (si no, usa la mesa activa).
3. **Lee el rectángulo** de la mesa (`artboardRect`) y lo normaliza (izquierda, arriba, derecha, abajo).
4. **Selecciona los objetos** de esa mesa con `selectObjectsOnActiveArtboard()` y obtiene los "objetos raíz" (los elementos de nivel superior, ignorando subgrupos).
5. **Calcula la posición** de la nueva mesa:
   - Busca la mesa más a la derecha y coloca la copia a 120 pt de distancia.
   - Si se pasa del límite de canvas (16000 pt), recalcula para ponerla en una fila nueva debajo.
6. **Crea la mesa nueva** con `doc.artboards.add(newRect)` y la nombra `"nombre original - copia"`.
7. **Crea una capa nueva** "Duplicado N".
8. **Duplica cada objeto** con `item.duplicate()`, lo mueve a la capa nueva y lo traslada (`translate`) a la posición correspondiente.
9. **Si el usuario eligió convertir textos a curvas**, recorre los objetos copiados buscando `TextFrame` y aplica `createOutline()`.
10. **Muestra un mensaje final** confirmando el resultado.

### Funciones auxiliares clave:
- `collectSourceRoots()` – selecciona y recopila los objetos de la mesa origen.
- `safeArtboardRect()` – lee coordenadas de forma segura.
- `getMaxRightArtboard()` / `getMinLeftArtboard()` / `getMinBottomArtboard()` – calculan límites para posicionar la copia.
- `duplicateItem()` – duplica, desbloquea y mueve el objeto.
- `collectTextOutlines()` – convierte textos a curvas recursivamente.
- `saveState()` / `unlockChain()` / `restoreState()` – guardan y restauran el estado de bloqueo/visibilidad de los objetos para poder duplicarlos aunque estén bloqueados u ocultos.

---

## ¿Cuál es el objetivo del script?

El objetivo es **automatizar la duplicación de mesas de trabajo en Illustrator** de forma segura y sin errores, copiando únicamente el contenido de la mesa seleccionada. Es especialmente útil en flujos de trabajo de **impresión y diseño de banners** (como sugiere la carpeta "BANNER ARAÑA PRO LION Y GIXXER"), donde se necesita generar múltiples versiones de un mismo diseño (por ejemplo, variantes de un banner) manteniendo el contenido y evitando el error de límite de lienzo de Illustrator.