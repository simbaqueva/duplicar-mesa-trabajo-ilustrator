// duplicar_mesa_trabajo.jsx
// Duplica una mesa de trabajo de Illustrator y copia solo los objetos de esa mesa.
// FIX: valida el limite de canvas de Illustrator (~227 in / 16383 pt desde el origen)
// antes de crear la mesa nueva, para evitar el error:
// "an Illustrator error occurred: 1095724867 ('AOoC')"
// Si no hay espacio a la derecha, la nueva mesa se coloca automaticamente
// en una fila nueva debajo, en vez de intentar salirse del area de trabajo.

// Limite seguro de Illustrator (el limite real es ~16383pt / 227.5in desde el origen 0,0).
// Se deja un pequeno margen de seguridad.
var CANVAS_LIMIT = 16000;

if (app.documents.length === 0) {
    alert("Abra un documento en Illustrator antes de ejecutar el script.");
} else {
    var doc = app.activeDocument;

    try {
        var artboardCount = doc.artboards.length;
        var defaultIndex = doc.artboards.getActiveArtboardIndex() + 1;
        var promptValue = prompt("Ingrese el número de la mesa de trabajo a copiar (1 - " + artboardCount + "):", defaultIndex);
        var sourceIndex = parseInt(promptValue, 10) - 1;
        if (isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= artboardCount) {
            alert("Número de mesa de trabajo inválido. Se usará la mesa activa.");
            sourceIndex = doc.artboards.getActiveArtboardIndex();
        }

        var sourceAB = doc.artboards[sourceIndex];
        var rect = safeArtboardRect(sourceAB);
        if (!rect) {
            throw new Error("No se pudo leer la mesa de trabajo seleccionada.");
        }

        var left = rect[0];
        var top = rect[1];
        var right = rect[2];
        var bottom = rect[3];
        var width = right - left;
        var height = top - bottom;
        var gap = 120;

        if (!areNumbers([left, top, right, bottom, width])) {
            throw new Error("Coordenadas inválidas de la mesa de trabajo.");
        }

        var convertText = confirm("¿Desea convertir los textos de la copia a curvas?");
        var sourceRoots = collectSourceRoots(doc, sourceIndex);

        if (sourceRoots.length === 0) {
            alert("No se encontraron objetos dentro de la mesa de trabajo seleccionada.");
        } else {
            var rightmost = getMaxRightArtboard(doc, right);
            var newLeft = rightmost + gap;
            var newRight = newLeft + width;

            // --- FIX: si no cabe a la derecha, saltar a una fila nueva debajo ---
            if (newRight > CANVAS_LIMIT) {
                var leftmost = getMinLeftArtboard(doc, left);
                var bottommost = getMinBottomArtboard(doc, bottom);
                newLeft = leftmost;
                newRight = newLeft + width;
                top = bottommost - gap;
                bottom = top - height;

                if (newRight > CANVAS_LIMIT || Math.abs(bottom) > CANVAS_LIMIT) {
                    alert(
                        "No hay espacio disponible dentro del área de trabajo de Illustrator " +
                        "(límite aprox. 227 pulgadas / 16383 pt desde el origen).\n\n" +
                        "Mueva o elimine mesas de trabajo existentes, o reduzca su tamaño, antes de duplicar de nuevo."
                    );
                    throw new Error("__CANCELLED__");
                }
            }

            var newRect = [Number(newLeft), Number(top), Number(newRight), Number(bottom)];

            if (!areNumbers(newRect)) {
                throw new Error("Coordenadas inválidas para crear la nueva mesa de trabajo: " + newRect);
            }

            var newAB;
            try {
                newAB = doc.artboards.add(newRect);
            } catch (e) {
                alert("Error al crear artboard con rect: [" + newRect.join(",") + "]\n" +
                      "tipos: [" + typeof newRect[0] + "," + typeof newRect[1] + "," + typeof newRect[2] + "," + typeof newRect[3] + "]\n" +
                      "error: " + e + "\n\n" +
                      "Esto suele pasar cuando la nueva mesa queda fuera del área de trabajo de Illustrator.\n" +
                      "Intente mover las mesas existentes más cerca del origen (0,0) o reduzca su tamaño.");
                throw e;
            }
            newAB.name = sourceAB.name + " - copia";

            var copyLayer = createCopyLayer(doc);
            var outlinedSelection = [];

            for (var i = 0; i < sourceRoots.length; i++) {
                var dup = duplicateItem(sourceRoots[i], newLeft - left, top - rect[1], copyLayer);
                if (dup && convertText) {
                    collectTextOutlines(dup, outlinedSelection);
                }
            }

            if (convertText) {
                doc.selection = outlinedSelection.length > 0 ? outlinedSelection : null;
                alert("Mesa de trabajo duplicada y los textos de la copia se han convertido a curvas.");
            } else {
                doc.selection = null;
                alert("Mesa de trabajo duplicada sin convertir textos a curvas.");
            }
        }
    } catch (e) {
        if (e.message !== "__CANCELLED__") {
            alert("Error: " + e.message);
        }
    }
}

function collectSourceRoots(doc, sourceIndex) {
    var previousIndex = doc.artboards.getActiveArtboardIndex();
    var roots = [];

    try {
        if (previousIndex !== sourceIndex) {
            doc.artboards.setActiveArtboardIndex(sourceIndex);
        }
        doc.selection = null;
        doc.selectObjectsOnActiveArtboard();

        var selection = doc.selection;
        if (selection && selection.length) {
            for (var i = 0; i < selection.length; i++) {
                var root = getRootItem(selection[i]);
                if (root && !arrayContains(roots, root)) {
                    roots.push(root);
                }
            }
        }
    } catch (e) {
        roots = [];
    } finally {
        doc.selection = null;
        try {
            if (previousIndex !== sourceIndex) {
                doc.artboards.setActiveArtboardIndex(previousIndex);
            }
        } catch (ignored) {
            // Ignorar fallos al restaurar la mesa activa.
        }
    }

    return roots;
}

function safeArtboardRect(artboard) {
    try {
        if (artboard && artboard.artboardRect && artboard.artboardRect.length === 4) {
            var raw = artboard.artboardRect;
            var rect = [Number(raw[0]), Number(raw[1]), Number(raw[2]), Number(raw[3])];
            if (areNumbers(rect)) {
                return normalizeRect(rect);
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}

function getMaxRightArtboard(doc, startRight) {
    var maxRight = Number(startRight);
    for (var i = 0; i < doc.artboards.length; i++) {
        var rect = safeArtboardRect(doc.artboards[i]);
        if (rect && rect[2] > maxRight) {
            maxRight = rect[2];
        }
    }
    return maxRight;
}

// --- Nuevas funciones auxiliares para el salto de fila ---
function getMinLeftArtboard(doc, startLeft) {
    var minLeft = Number(startLeft);
    for (var i = 0; i < doc.artboards.length; i++) {
        var rect = safeArtboardRect(doc.artboards[i]);
        if (rect && rect[0] < minLeft) {
            minLeft = rect[0];
        }
    }
    return minLeft;
}

function getMinBottomArtboard(doc, startBottom) {
    var minBottom = Number(startBottom);
    for (var i = 0; i < doc.artboards.length; i++) {
        var rect = safeArtboardRect(doc.artboards[i]);
        if (rect && rect[3] < minBottom) {
            minBottom = rect[3];
        }
    }
    return minBottom;
}

function normalizeRect(rect) {
    var left = Number(rect[0]);
    var top = Number(rect[1]);
    var right = Number(rect[2]);
    var bottom = Number(rect[3]);

    if (right < left) {
        var tmp = left;
        left = right;
        right = tmp;
    }
    if (top < bottom) {
        var tmp = top;
        top = bottom;
        bottom = tmp;
    }

    return [left, top, right, bottom];
}

function createCopyLayer(doc) {
    var baseName = "Duplicado ";
    var existingNames = [];
    for (var i = 0; i < doc.layers.length; i++) {
        existingNames.push(doc.layers[i].name);
    }
    var index = 1;
    while (arrayContains(existingNames, baseName + index)) {
        index++;
    }
    var layer = doc.layers.add();
    layer.name = baseName + index;
    return layer;
}

function collectTextOutlines(item, outlinedSelection) {
    if (!item) {
        return;
    }

    if (item.typename === "TextFrame") {
        try {
            var outline = item.createOutline();
            if (outline) {
                outlinedSelection.push(outline);
            }
        } catch (e) {
            // ignore text outline failures
        }
    } else if (item.pageItems && item.pageItems.length > 0) {
        for (var i = 0; i < item.pageItems.length; i++) {
            collectTextOutlines(item.pageItems[i], outlinedSelection);
        }
    }
}

function getRootItem(item) {
    var root = item;
    while (root.parent && root.parent.typename !== "Layer") {
        root = root.parent;
    }
    return root;
}

function getItemBounds(item) {
    if (item.visibleBounds && item.visibleBounds.length === 4) {
        return [item.visibleBounds[0], item.visibleBounds[1], item.visibleBounds[2], item.visibleBounds[3]];
    }
    if (item.geometricBounds && item.geometricBounds.length === 4) {
        return [item.geometricBounds[0], item.geometricBounds[1], item.geometricBounds[2], item.geometricBounds[3]];
    }
    return null;
}

function duplicateItem(item, dx, dy, targetLayer) {
    var state = [];
    saveState(item, state);
    unlockChain(item);

    try {
        var dup = item.duplicate();
        if (dup.layer) {
            dup.layer = targetLayer;
        }
        dup.translate(dx, dy);
        return dup;
    } catch (e) {
        return null;
    } finally {
        restoreState(state);
    }
}

function saveState(item, state) {
    var current = item;
    while (current && current.typename !== "Layer") {
        state.push({ obj: current, locked: current.locked, hidden: current.hidden });
        current = current.parent;
    }
    if (item.layer) {
        state.push({ obj: item.layer, locked: item.layer.locked, hidden: item.layer.hidden });
    }
}

function unlockChain(item) {
    var current = item;
    while (current && current.typename !== "Layer") {
        current.locked = false;
        current.hidden = false;
        current = current.parent;
    }
    if (item.layer) {
        item.layer.locked = false;
    }
}

function restoreState(state) {
    for (var i = state.length - 1; i >= 0; i--) {
        var entry = state[i];
        entry.obj.locked = entry.locked;
        entry.obj.hidden = entry.hidden;
    }
}

function arrayContains(arr, value) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === value) {
            return true;
        }
    }
    return false;
}

function boundsInside(parent, child) {
    return child[0] >= parent[0] && child[2] <= parent[2] && child[1] <= parent[1] && child[3] >= parent[3];
}

// Tolerancia para evitar que errores de redondeo (ej. 0.0004pt) excluyan
// objetos que en la práctica sí tocan el borde de la mesa.
var BOUNDS_EPSILON = 0.5;

// Devuelve true si los rects [left, top, right, bottom] se superponen en algo,
// aunque sea parcialmente (a diferencia de boundsInside, que exige contención total).
function rectsOverlap(a, b) {
    var noOverlap =
        b[0] > a[2] + BOUNDS_EPSILON ||  // b empieza a la derecha de a
        b[2] < a[0] - BOUNDS_EPSILON ||  // b termina a la izquierda de a
        b[1] < a[3] - BOUNDS_EPSILON ||  // b (top) está por debajo del fondo de a
        b[3] > a[1] + BOUNDS_EPSILON;    // b (bottom) está por encima del tope de a
    return !noOverlap;
}

function isNumber(value) {
    return value !== null && value !== undefined && typeof value === "number" && !isNaN(value);
}

function areNumbers(values) {
    for (var i = 0; i < values.length; i++) {
        if (!isNumber(values[i])) {
            return false;
        }
    }
    return true;
}