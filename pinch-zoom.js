// Unified drag and pinch gestures for the segment editor canvas.
// Uses the same imageTransform values as the sliders so every control stays in sync.

enableCanvasDragging = function enableCanvasGestures(segment) {
  if (!segment.imageUrl || !(segment.type === 'image' || segment.type === 'imageText')) return;

  const pointers = new Map();
  let dragStart = null;
  let pinchStart = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const syncControls = () => {
    const transform = getTransform(segment);
    const zoom = document.getElementById('imageZoom');
    const x = document.getElementById('imageX');
    const y = document.getElementById('imageY');
    if (zoom) zoom.value = transform.zoom;
    if (x) x.value = transform.x;
    if (y) y.value = transform.y;
  };

  const paint = () => {
    renderVisualInto(segmentCanvas, segment);
    renderPreview(segment);
  };

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const beginDrag = point => {
    dragStart = {
      point: { ...point },
      transform: { ...getTransform(segment) }
    };
  };

  const beginPinch = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    pinchStart = {
      distance: Math.max(1, distance(a, b)),
      midpoint: midpoint(a, b),
      transform: { ...getTransform(segment) }
    };
    dragStart = null;
  };

  const onDown = event => {
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, point);
    segmentCanvas.setPointerCapture?.(event.pointerId);

    if (pointers.size === 1) beginDrag(point);
    if (pointers.size === 2) beginPinch();
  };

  const onMove = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const rect = segmentCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (pointers.size >= 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const currentDistance = Math.max(1, distance(a, b));
      const currentMidpoint = midpoint(a, b);
      const ratio = currentDistance / pinchStart.distance;
      const zoom = clamp(pinchStart.transform.zoom * ratio, 1, 3);

      // Moving the pinch centre also pans, which makes the gesture feel natural.
      const dx = ((currentMidpoint.x - pinchStart.midpoint.x) / rect.width) * 100;
      const dy = ((currentMidpoint.y - pinchStart.midpoint.y) / rect.height) * 100;

      segment.imageTransform = {
        zoom,
        x: clamp(pinchStart.transform.x - dx, 0, 100),
        y: clamp(pinchStart.transform.y - dy, 0, 100)
      };
      syncControls();
      paint();
      return;
    }

    if (pointers.size === 1 && dragStart) {
      const point = [...pointers.values()][0];
      const dx = ((point.x - dragStart.point.x) / rect.width) * 100;
      const dy = ((point.y - dragStart.point.y) / rect.height) * 100;

      segment.imageTransform = {
        zoom: dragStart.transform.zoom,
        x: clamp(dragStart.transform.x - dx, 0, 100),
        y: clamp(dragStart.transform.y - dy, 0, 100)
      };
      syncControls();
      paint();
    }
  };

  const onUp = event => {
    if (pointers.has(event.pointerId)) pointers.delete(event.pointerId);

    if (pointers.size === 1) {
      const point = [...pointers.values()][0];
      pinchStart = null;
      beginDrag(point);
    } else if (pointers.size === 0) {
      pinchStart = null;
      dragStart = null;
      renderTimeline();
    }
  };

  segmentCanvas.onpointerdown = onDown;
  segmentCanvas.onpointermove = onMove;
  segmentCanvas.onpointerup = onUp;
  segmentCanvas.onpointercancel = onUp;
  segmentCanvas.onlostpointercapture = onUp;
};
