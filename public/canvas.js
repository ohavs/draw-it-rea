/**
 * Reconstructed Drawing Engine (based on REA static & semantic analysis of Canvas drawing apps).
 * Features:
 * - Normalized [0..1] vector coordinates for resolution independence across devices
 * - DevicePixelRatio (Retina/HiDPI) crisp scaling
 * - Quadratic Bezier curve smoothing + 2px pointer decimation
 * - Undo stack, background fill, eraser, and animated stroke replay on gallery canvases
 */
(function () {
  const PALETTE = [
    '#1e293b', // Slate Black
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#78350f', // Brown
    '#94a3b8', // Grey
    '#ffffff', // White
  ];

  const SIZES = [
    { label: 'דק', size: 3 },
    { label: 'רגיל', size: 6 },
    { label: 'עבה', size: 12 },
    { label: 'ענק', size: 22 },
  ];

  let canvas = null;
  let ctx = null;
  let cssWidth = 0;
  let cssHeight = 0;

  let currentTool = 'pen'; // 'pen' | 'eraser' | 'fill'
  let currentColor = PALETTE[0];
  let currentSize = SIZES[1].size;
  let bgColor = '#ffffff';

  let strokes = [];
  let currentStroke = null;
  let isDrawingEnabled = true;
  let onChangeCallback = null;

  function init(canvasElement, onChange) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    onChangeCallback = onChange || (() => {});

    canvas.style.touchAction = 'none';
    resize();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resize());
      ro.observe(parent);
    } else {
      window.addEventListener('resize', resize);
    }
  }

  function resize() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w <= 0 || h <= 0) return;

    cssWidth = w;
    cssHeight = h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rerender();
  }

  function getNormalizedPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1))),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / (rect.height || 1))),
    };
  }

  function onPointerDown(e) {
    if (!isDrawingEnabled) return;
    if (cssWidth === 0 || cssHeight === 0) resize();
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const pt = getNormalizedPoint(e);

    if (currentTool === 'fill') {
      bgColor = currentColor;
      strokes.push({
        tool: 'fill',
        color: currentColor,
        size: 0,
        points: [],
      });
      rerender();
      notifyChange();
      return;
    }

    const activeColor = currentTool === 'eraser' ? bgColor : currentColor;
    const activeSize = currentTool === 'eraser' ? Math.max(16, currentSize * 1.8) : currentSize;

    currentStroke = {
      tool: currentTool,
      color: activeColor,
      size: activeSize,
      points: [pt],
    };

    drawDot(ctx, pt, activeColor, activeSize, cssWidth, cssHeight);
  }

  function onPointerMove(e) {
    if (!currentStroke || !isDrawingEnabled) return;
    const pt = getNormalizedPoint(e);
    const pts = currentStroke.points;
    const last = pts[pts.length - 1];

    const dx = (pt.x - last.x) * cssWidth;
    const dy = (pt.y - last.y) * cssHeight;
    if (Math.hypot(dx, dy) < 2) return; // 2px decimation from REA analysis

    pts.push(pt);
    rerender();
    renderStrokeOn(ctx, currentStroke, cssWidth, cssHeight, bgColor);
  }

  function onPointerUp() {
    if (!currentStroke) return;
    if (currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      rerender();
      notifyChange();
    }
    currentStroke = null;
  }

  function drawDot(targetCtx, pt, color, size, w, h) {
    targetCtx.fillStyle = color;
    targetCtx.beginPath();
    targetCtx.arc(pt.x * w, pt.y * h, size / 2, 0, Math.PI * 2);
    targetCtx.fill();
  }

  function renderStrokeOn(targetCtx, stroke, w, h, currentBg = '#ffffff') {
    if (stroke.tool === 'fill') {
      targetCtx.fillStyle = stroke.color;
      targetCtx.fillRect(0, 0, w, h);
      return stroke.color;
    }

    const pts = stroke.points;
    if (!pts || pts.length === 0) return currentBg;

    const strokeColor = stroke.tool === 'eraser' ? currentBg : stroke.color;
    targetCtx.strokeStyle = strokeColor;
    targetCtx.fillStyle = strokeColor;
    targetCtx.lineWidth = stroke.size || 5;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    if (pts.length === 1) {
      drawDot(targetCtx, pts[0], strokeColor, stroke.size || 5, w, h);
      return currentBg;
    }

    targetCtx.beginPath();
    targetCtx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = ((pts[i].x + pts[i + 1].x) / 2) * w;
      const midY = ((pts[i].y + pts[i + 1].y) / 2) * h;
      targetCtx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
    }
    const last = pts[pts.length - 1];
    targetCtx.lineTo(last.x * w, last.y * h);
    targetCtx.stroke();
    return currentBg;
  }

  function rerender() {
    if (!ctx || cssWidth === 0 || cssHeight === 0) return;
    let activeBg = '#ffffff';
    ctx.fillStyle = activeBg;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    for (const s of strokes) {
      activeBg = renderStrokeOn(ctx, s, cssWidth, cssHeight, activeBg);
    }
    bgColor = activeBg;
  }

  function undo() {
    if (strokes.length === 0) return;
    strokes.pop();
    rerender();
    notifyChange();
  }

  function clearAll() {
    strokes = [];
    bgColor = '#ffffff';
    rerender();
    notifyChange();
  }

  function resetForNewRound() {
    strokes = [];
    currentStroke = null;
    bgColor = '#ffffff';
    currentTool = 'pen';
    isDrawingEnabled = true;
    setTimeout(() => resize(), 30);
  }

  function notifyChange() {
    if (typeof onChangeCallback === 'function') {
      onChangeCallback(strokes, exportDataUrl());
    }
  }

  function exportDataUrl() {
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /**
   * Renders or animates a player's strokes onto any gallery/preview canvas element
   */
  function renderToGalleryCanvas(targetCanvas, playerStrokes = [], fallbackDataUrl = null, animate = true) {
    const tCtx = targetCanvas.getContext('2d');
    const rect = targetCanvas.getBoundingClientRect();
    const w = Math.max(220, Math.floor(rect.width || 280));
    const h = Math.max(165, Math.floor(rect.height || 210));
    const dpr = window.devicePixelRatio || 1;

    targetCanvas.width = w * dpr;
    targetCanvas.height = h * dpr;
    tCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, w, h);

    if ((!playerStrokes || playerStrokes.length === 0) && fallbackDataUrl) {
      const img = new Image();
      img.onload = () => tCtx.drawImage(img, 0, 0, w, h);
      img.src = fallbackDataUrl;
      return;
    }

    if (!playerStrokes || playerStrokes.length === 0) {
      // Empty canvas placeholder text
      tCtx.fillStyle = '#94a3b8';
      tCtx.font = '500 14px Rubik, sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText('לא צויר דבר בסיבוב זה 😅', w / 2, h / 2);
      return;
    }

    if (!animate) {
      let activeBg = '#ffffff';
      for (const s of playerStrokes) {
        activeBg = renderStrokeOn(tCtx, s, w, h, activeBg);
      }
      return;
    }

    // Animated stroke-by-stroke replay
    let idx = 0;
    let activeBg = '#ffffff';
    function step() {
      if (idx >= playerStrokes.length) return;
      activeBg = renderStrokeOn(tCtx, playerStrokes[idx], w, h, activeBg);
      idx += 1;
      setTimeout(() => requestAnimationFrame(step), 65);
    }
    step();
  }

  window.DrawEngine = {
    PALETTE,
    SIZES,
    init,
    resize,
    setTool: (t) => { currentTool = t; },
    getTool: () => currentTool,
    setColor: (c) => { currentColor = c; },
    getColor: () => currentColor,
    setSize: (s) => { currentSize = s; },
    getSize: () => currentSize,
    setEnabled: (flag) => { isDrawingEnabled = Boolean(flag); },
    undo,
    clearAll,
    resetForNewRound,
    getStrokes: () => strokes.slice(),
    getDataUrl: exportDataUrl,
    renderToGalleryCanvas,
  };
})();
