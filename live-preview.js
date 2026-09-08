// Keep the image mounted while editing so zoom and reposition changes feel immediate.
// Reusing the existing image avoids decoding the same large data URL on every movement.

function liveImageTransform(img, segment) {
  const transform = segment.imageTransform || {};
  const zoom = Number.isFinite(Number(transform.zoom)) ? Math.max(1, Number(transform.zoom)) : 1;
  const x = Number.isFinite(Number(transform.x)) ? Math.max(0, Math.min(100, Number(transform.x))) : 50;
  const y = Number.isFinite(Number(transform.y)) ? Math.max(0, Math.min(100, Number(transform.y))) : 50;

  // object-position handles the normal object-fit: cover crop. The translate component
  // pans across the extra image area created by zooming. At zoom 1 the translate is 0.
  const panX = ((50 - x) * (zoom - 1)) / zoom;
  const panY = ((50 - y) * (zoom - 1)) / zoom;

  img.style.objectPosition = `${x}% ${y}%`;
  img.style.transform = `scale(${zoom}) translate(${panX}%, ${panY}%)`;
  img.style.transformOrigin = 'center center';
  img.style.willChange = 'transform, object-position';
}

renderVisualInto = function renderVisualIntoLive(container, segment) {
  if (!segment) {
    container.innerHTML = '<div class="preview-placeholder">Select a segment</div>';
    return;
  }

  const usesImage = segment.type === 'image' || segment.type === 'imageText';
  let img = container.querySelector(':scope > img[data-slide-image]');

  if (usesImage && segment.imageUrl) {
    if (!img) {
      img = document.createElement('img');
      img.dataset.slideImage = 'true';
      img.alt = '';
      container.prepend(img);
    }
    if (img.src !== segment.imageUrl) img.src = segment.imageUrl;
    liveImageTransform(img, segment);
  } else if (img) {
    img.remove();
    img = null;
  }

  let placeholder = container.querySelector(':scope > .preview-placeholder');
  const needsPlaceholder = usesImage && !segment.imageUrl;
  if (needsPlaceholder) {
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'preview-placeholder';
      container.appendChild(placeholder);
    }
    placeholder.textContent = 'Add an image';
  } else if (placeholder) {
    placeholder.remove();
  }

  let text = container.querySelector(':scope > .preview-text');
  if (segment.type === 'text' || segment.type === 'blank') {
    if (!text) {
      text = document.createElement('div');
      text.className = 'preview-text';
      container.appendChild(text);
    }
    text.textContent = segment.text || (segment.type === 'text' ? 'Text slide' : 'Blank frame');
  } else if (text) {
    text.remove();
  }

  let overlay = container.querySelector(':scope > .preview-overlay');
  if (segment.type === 'imageText') {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'preview-overlay';
      container.appendChild(overlay);
    }
    overlay.textContent = segment.text || 'Overlay text';
  } else if (overlay) {
    overlay.remove();
  }
};
