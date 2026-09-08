// Keep the image mounted while editing so crop changes feel immediate.
// Positioning is calculated from the image's real aspect ratio rather than from
// a fixed 100% x 100% object-fit box. This means natural cover overflow can be
// repositioned even at minimum zoom.

function readTransform(segment) {
  const transform = segment.imageTransform || {};
  return {
    zoom: Number.isFinite(Number(transform.zoom)) ? Math.max(1, Number(transform.zoom)) : 1,
    x: Number.isFinite(Number(transform.x)) ? Math.max(0, Math.min(100, Number(transform.x))) : 50,
    y: Number.isFinite(Number(transform.y)) ? Math.max(0, Math.min(100, Number(transform.y))) : 50
  };
}

function positionImageInContainer(img, container, segment) {
  const t = readTransform(segment);
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  if (!cw || !ch || !iw || !ih) return;

  // Base scale is the exact cover scale for the current 16:9 canvas.
  const coverScale = Math.max(cw / iw, ch / ih);
  const scale = coverScale * t.zoom;
  const renderedW = iw * scale;
  const renderedH = ih * scale;

  // The image may already have overflow at zoom 1 because its aspect ratio does
  // not match 16:9. Zooming adds more overflow. x/y map across that full range.
  const overflowX = Math.max(0, renderedW - cw);
  const overflowY = Math.max(0, renderedH - ch);
  const left = -(overflowX * (t.x / 100));
  const top = -(overflowY * (t.y / 100));

  img.style.position = 'absolute';
  img.style.width = `${renderedW}px`;
  img.style.height = `${renderedH}px`;
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';
  img.style.left = `${left}px`;
  img.style.top = `${top}px`;
  img.style.objectFit = 'fill';
  img.style.objectPosition = '50% 50%';
  img.style.transform = 'none';
  img.style.transformOrigin = '0 0';
  img.style.willChange = 'left, top, width, height';
}

function liveImageTransform(img, segment) {
  const container = img.parentElement;
  if (!container) return;

  const apply = () => positionImageInContainer(img, container, segment);
  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener('load', apply, { once: true });
}

applyImageTransform = function applyImageTransformLive(img, segment) {
  // Timeline thumbnails are created before they are attached. Apply after load
  // and once again on the next frame when the parent has measurable dimensions.
  const apply = () => liveImageTransform(img, segment);
  if (img.complete && img.naturalWidth) requestAnimationFrame(apply);
  else img.addEventListener('load', () => requestAnimationFrame(apply), { once: true });
};

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

    if (img.src !== segment.imageUrl) {
      img.src = segment.imageUrl;
      img.addEventListener('load', () => liveImageTransform(img, segment), { once: true });
    } else {
      liveImageTransform(img, segment);
    }
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

window.addEventListener('resize', () => {
  document.querySelectorAll('img[data-slide-image]').forEach(img => {
    const segment = state.project.segments.find(item => item.id === state.selectedId);
    if (segment) liveImageTransform(img, segment);
  });
});
