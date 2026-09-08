// Keep the image mounted while editing so zoom and reposition changes feel immediate.
// app.js calls renderVisualInto repeatedly during slider and drag input. Reusing the
// existing image avoids decoding the same large data URL on every movement.

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

    const transform = segment.imageTransform || {};
    const zoom = Number.isFinite(Number(transform.zoom)) ? Number(transform.zoom) : 1;
    const x = Number.isFinite(Number(transform.x)) ? Number(transform.x) : 50;
    const y = Number.isFinite(Number(transform.y)) ? Number(transform.y) : 50;

    img.style.objectPosition = `${x}% ${y}%`;
    img.style.transform = `scale(${zoom})`;
    img.style.transformOrigin = 'center center';
    img.style.willChange = 'transform, object-position';
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
