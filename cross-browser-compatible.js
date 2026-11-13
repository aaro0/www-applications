const sandbox = document.getElementById('sandbox');
const realContent = document.getElementById('real-content');
const lensWindow = document.getElementById('lens-window');
const lensPortal = document.getElementById('lens-portal');

// 1. Clone the real sandbox content into our portal
lensPortal.innerHTML = realContent.innerHTML;

const LENS_WIDTH = 120;
const LENS_HEIGHT = 60;
const FLOAT_OFFSET = 20;

let rafId = null;
let isSelecting = false;
let hideTimeout = null;

// Check if the selection is inside our real content box
function isSelectionInSandbox(selection) {
    return (
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        realContent.contains(selection.focusNode)
    );
}

// Maps a node's position relative to a root container (e.g. [0, 1, 0])
function getNodePath(node, root) {
    const path = [];
    let current = node;
    while (current && current !== root && current.parentNode) {
        path.push(Array.from(current.parentNode.childNodes).indexOf(current));
        current = current.parentNode;
    }
    return path.reverse();
}

// Finds the corresponding node in the cloned container using the path
function getNodeFromPath(path, root) {
    let current = root;
    for (const index of path) {
        if (!current.childNodes[index]) return null;
        current = current.childNodes[index];
    }
    return current;
}

function renderTextMagnifier() {
    rafId = null;
    const selection = window.getSelection();

    if (!isSelectionInSandbox(selection)) {
        lensWindow.classList.add('hidden');
        if (CSS.highlights) CSS.highlights.clear(); // Clear portal selection
        return;
    }

    const nativeRange = selection.getRangeAt(0);

    // --- NEW: Mirror the selection highlight in the portal ---
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
        const startPath = getNodePath(nativeRange.startContainer, realContent);
        const endPath = getNodePath(nativeRange.endContainer, realContent);

        const cloneStartNode = getNodeFromPath(startPath, lensPortal);
        const cloneEndNode = getNodeFromPath(endPath, lensPortal);

        if (cloneStartNode && cloneEndNode) {
            const cloneRange = new Range();
            cloneRange.setStart(cloneStartNode, nativeRange.startOffset);
            cloneRange.setEnd(cloneEndNode, nativeRange.endOffset);

            const highlight = new Highlight(cloneRange);
            CSS.highlights.set('portal-selection', highlight);
        }
    }
    // ---------------------------------------------------------

    const activeRange = document.createRange();
    activeRange.setStart(selection.focusNode, selection.focusOffset);
    activeRange.collapse(true);

    const activeRect = activeRange.getBoundingClientRect();
    const sandboxRect = sandbox.getBoundingClientRect();

    if (activeRect.width === 0 && activeRect.height === 0 && activeRect.x === 0) {
        lensWindow.classList.add('hidden');
        return;
    }

    // 1. Calculate the exact target point we want to magnify (center of selection)
    const caretX = activeRect.left - sandboxRect.left + (activeRect.width / 2);
    const caretY = activeRect.top - sandboxRect.top + (activeRect.height / 2);

    // 2. Position the lens window physically (floating above the finger)
    const lensTopLeftX = caretX - (LENS_WIDTH / 2);
    const lensTopLeftY = caretY - FLOAT_OFFSET - LENS_HEIGHT;

    // 3. Move the lens window FORWARD
    lensWindow.style.transform = `translate3d(${lensTopLeftX}px, ${lensTopLeftY}px, 0)`;

    // 4. Shift the portal so the target point sits in the exact middle of the 120x60 lens
    const portalTx = (LENS_WIDTH / 2) - caretX;
    const portalTy = (LENS_HEIGHT / 2) - caretY - FLOAT_OFFSET + 20 /* <== magic number */;

    // 5. Apply translation only (CSS scaling and transform-origin removed per request)
    lensPortal.style.transform = `translate3d(${portalTx}px, ${portalTy}px, 0)`;

    lensWindow.classList.remove('hidden');
}

function scheduleUpdate() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(renderTextMagnifier);
}

// --- Tracking Events ---

realContent.addEventListener('pointerdown', () => {
    isSelecting = true;
    clearTimeout(hideTimeout);
});

document.addEventListener('pointermove', () => {
    if (isSelecting) {
        scheduleUpdate();
    }
});

document.addEventListener('pointerup', () => {
    if (!isSelecting) return;
    isSelecting = false;
    scheduleUpdate();
    
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        lensWindow.classList.add('hidden');
    }, 1500);
});

document.addEventListener('selectionchange', () => {
    scheduleUpdate();
    
    // If selecting via keyboard (Shift + Arrow keys)
    if (!isSelecting) {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            lensWindow.classList.add('hidden');
        }, 1500);
    }
});