const state = {
  project: {
    schemaVersion: 2,
    title: "My podcast episode",
    duration: 600,
    format: { width: 1920, height: 1080 },
    segments: []
  },
  selectedId: null
};

const timeline = document.getElementById("timeline");
const projectTitle = document.getElementById("projectTitle");
const projectMeta = document.getElementById("projectMeta");
const previewFrame = document.getElementById("previewFrame");
const segmentEditor = document.getElementById("segmentEditor");
const projectDialog = document.getElementById("projectDialog");
const segmentDialog = document.getElementById("segmentDialog");
const projectForm = document.getElementById("projectForm");
const segmentForm = document.getElementById("segmentForm");
const projectDurationInput = document.getElementById("projectDurationInput");
const durationNotice = document.getElementById("durationNotice");
const jsonViewDialog = document.getElementById("jsonViewDialog");
const jsonViewOutput = document.getElementById("jsonViewOutput");
const jsonImportDialog = document.getElementById("jsonImportDialog");
const jsonImportForm = document.getElementById("jsonImportForm");
const jsonImportInput = document.getElementById("jsonImportInput");
const jsonImportError = document.getElementById("jsonImportError");
const segmentEditDialog = document.getElementById("segmentEditDialog");
const segmentCanvas = document.getElementById("segmentCanvas");
const segmentEditControls = document.getElementById("segmentEditControls");

const pad = value => String(value).padStart(2, "0");

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

function parseTime(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

function sortSegments() {
  state.project.segments.sort((a, b) => a.start - b.start);
}

function nextSegmentAfter(segment) {
  sortSegments();
  const index = state.project.segments.findIndex(item => item.id === segment.id);
  return index >= 0 ? state.project.segments[index + 1] : null;
}

function effectiveEnd(segment) {
  if (segment.endMode === "duration") return segment.start + (segment.duration || 0);
  if (segment.endMode === "end" && Number.isFinite(segment.end)) return segment.end;
  const next = nextSegmentAfter(segment);
  return next ? next.start : state.project.duration;
}

function typeLabel(type) {
  return { image: "Image", text: "Text", imageText: "Image + text", blank: "Blank" }[type] || type;
}

function segmentSummary(segment) {
  const end = effectiveEnd(segment);
  if (segment.endMode === "next") return `${formatTime(segment.start)} · until next (${formatTime(end)})`;
  if (segment.endMode === "duration") return `${formatTime(segment.start)} · ${segment.duration}s`;
  return `${formatTime(segment.start)} · to ${formatTime(end)}`;
}

function projectJson() {
  return JSON.stringify(state.project, null, 2);
}

function getTransform(segment) {
  const t = segment.imageTransform || {};
  return {
    zoom: Number.isFinite(Number(t.zoom)) ? Number(t.zoom) : 1,
    x: Number.isFinite(Number(t.x)) ? Number(t.x) : 50,
    y: Number.isFinite(Number(t.y)) ? Number(t.y) : 50
  };
}

function applyImageTransform(img, segment) {
  const t = getTransform(segment);
  img.style.objectPosition = `${t.x}% ${t.y}%`;
  img.style.transform = `scale(${t.zoom})`;
}

function segmentsBeyondDuration() {
  return state.project.segments.filter(segment => segment.start > state.project.duration || effectiveEnd(segment) > state.project.duration);
}

function renderDurationNotice() {
  const beyond = segmentsBeyondDuration();
  if (!beyond.length) {
    durationNotice.hidden = true;
    durationNotice.textContent = "";
    return;
  }
  durationNotice.hidden = false;
  durationNotice.textContent = `${beyond.length} segment${beyond.length === 1 ? " is" : "s are"} beyond the current timeline length. They remain in the JSON and have not been deleted.`;
}

function renderTimeline() {
  sortSegments();
  projectTitle.textContent = state.project.title;
  projectMeta.textContent = `${formatTime(state.project.duration)} · ${state.project.format.width} × ${state.project.format.height}`;
  projectDurationInput.value = formatTime(state.project.duration);
  timeline.innerHTML = "";

  if (!state.project.segments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-timeline";
    empty.innerHTML = `<strong>No segments yet.</strong><p>Add the first visual at 00:00, then build downward through the episode.</p>`;
    timeline.appendChild(empty);
    renderDurationNotice();
    return;
  }

  state.project.segments.forEach(segment => {
    const marker = document.createElement("div");
    marker.className = `time-marker${segment.start > state.project.duration ? " out-of-range" : ""}`;

    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = formatTime(segment.start);

    const card = document.createElement("article");
    card.className = `segment-card${state.selectedId === segment.id ? " selected" : ""}`;
    card.dataset.segmentId = segment.id;

    const thumb = document.createElement("div");
    thumb.className = "segment-thumb";
    if ((segment.type === "image" || segment.type === "imageText") && segment.imageUrl) {
      const img = document.createElement("img");
      img.src = segment.imageUrl;
      img.alt = "";
      applyImageTransform(img, segment);
      thumb.appendChild(img);
    } else {
      thumb.textContent = typeLabel(segment.type);
    }

    const copy = document.createElement("div");
    const heading = segment.title || segment.text || typeLabel(segment.type);
    copy.innerHTML = `<h4>${escapeHtml(heading)}</h4><p>${escapeHtml(segmentSummary(segment))}</p>`;

    const chip = document.createElement("div");
    chip.className = "segment-type";
    chip.textContent = segment.start > state.project.duration ? "Beyond end" : typeLabel(segment.type);

    card.append(thumb, copy, chip);
    card.addEventListener("click", () => {
      state.selectedId = segment.id;
      render();
      openSegmentEditor();
    });

    marker.append(label, card);
    timeline.appendChild(marker);
  });

  renderDurationNotice();
}

function renderVisualInto(container, segment) {
  container.innerHTML = "";
  if (!segment) {
    container.innerHTML = `<div class="preview-placeholder">Select a segment</div>`;
    return;
  }

  if ((segment.type === "image" || segment.type === "imageText") && segment.imageUrl) {
    const img = document.createElement("img");
    img.src = segment.imageUrl;
    img.alt = "";
    applyImageTransform(img, segment);
    container.appendChild(img);
  }

  if ((segment.type === "image" || segment.type === "imageText") && !segment.imageUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "preview-placeholder";
    placeholder.textContent = "Add an image";
    container.appendChild(placeholder);
  }

  if (segment.type === "text") {
    const text = document.createElement("div");
    text.className = "preview-text";
    text.textContent = segment.text || "Text slide";
    container.appendChild(text);
  }

  if (segment.type === "imageText") {
    const overlay = document.createElement("div");
    overlay.className = "preview-overlay";
    overlay.textContent = segment.text || "Overlay text";
    container.appendChild(overlay);
  }

  if (segment.type === "blank") {
    const blank = document.createElement("div");
    blank.className = "preview-text";
    blank.textContent = segment.text || "Blank frame";
    container.appendChild(blank);
  }
}

function renderPreview(segment) {
  renderVisualInto(previewFrame, segment);
}

function renderEditor() {
  const segment = state.project.segments.find(item => item.id === state.selectedId);
  renderPreview(segment);

  if (!segment) {
    segmentEditor.className = "segment-editor empty-state";
    segmentEditor.innerHTML = `<h3>Nothing selected</h3><p>Add a segment or select one from the timeline.</p>`;
    return;
  }

  segmentEditor.className = "segment-editor";
  segmentEditor.innerHTML = `
    <h3>${escapeHtml(typeLabel(segment.type))} segment</h3>
    <p class="segment-summary-copy">${escapeHtml(segmentSummary(segment))}</p>
    <button id="openSegmentEditorBtn" class="primary-btn" type="button">Edit segment</button>
  `;
  document.getElementById("openSegmentEditorBtn").addEventListener("click", openSegmentEditor);
}

function render() {
  renderTimeline();
  renderEditor();
  if (jsonViewDialog.open) jsonViewOutput.value = projectJson();
}

function renderSegmentEditScreen() {
  const segment = state.project.segments.find(item => item.id === state.selectedId);
  if (!segment) return;

  renderVisualInto(segmentCanvas, segment);
  const t = getTransform(segment);
  const showImageControls = segment.type === "image" || segment.type === "imageText";
  const showText = segment.type === "text" || segment.type === "imageText" || segment.type === "blank";

  segmentEditControls.innerHTML = `
    <label>Type
      <select id="screenEditType">
        <option value="image" ${segment.type === "image" ? "selected" : ""}>Image</option>
        <option value="text" ${segment.type === "text" ? "selected" : ""}>Text slide</option>
        <option value="imageText" ${segment.type === "imageText" ? "selected" : ""}>Image + text</option>
        <option value="blank" ${segment.type === "blank" ? "selected" : ""}>Blank / colour</option>
      </select>
    </label>

    ${showImageControls ? `
      <div class="image-upload-block">
        <label class="upload-button primary-btn" for="segmentImageFile">Choose image from phone</label>
        <input id="segmentImageFile" class="file-input" type="file" accept="image/*">
        ${segment.imageUrl ? `<button id="removeImageBtn" type="button" class="secondary-btn">Remove image</button>` : ""}
      </div>
      <label>Zoom
        <input id="imageZoom" type="range" min="1" max="3" step="0.01" value="${t.zoom}">
      </label>
      <div class="field-row">
        <label>Horizontal
          <input id="imageX" type="range" min="0" max="100" step="1" value="${t.x}">
        </label>
        <label>Vertical
          <input id="imageY" type="range" min="0" max="100" step="1" value="${t.y}">
        </label>
      </div>
      <button id="resetCropBtn" type="button" class="secondary-btn">Reset crop</button>
    ` : ""}

    ${showText ? `
      <label>Text
        <textarea id="screenEditText" placeholder="Slide or overlay text">${escapeHtml(segment.text || "")}</textarea>
      </label>
    ` : ""}

    <div class="timing-card">
      <div class="field-row">
        <label>Start time<input id="screenEditStart" value="${formatTime(segment.start)}"></label>
        <label>Timing
          <select id="screenEditTiming">
            <option value="next" ${segment.endMode === "next" ? "selected" : ""}>Until next</option>
            <option value="duration" ${segment.endMode === "duration" ? "selected" : ""}>Fixed duration</option>
            <option value="end" ${segment.endMode === "end" ? "selected" : ""}>Specific end</option>
          </select>
        </label>
      </div>
      <label id="screenDurationField" ${segment.endMode === "duration" ? "" : "hidden"}>Duration (seconds)
        <input id="screenEditDuration" type="number" min="1" value="${segment.duration || 10}">
      </label>
      <label id="screenEndField" ${segment.endMode === "end" ? "" : "hidden"}>End time
        <input id="screenEditEnd" value="${formatTime(segment.end ?? effectiveEnd(segment))}">
      </label>
    </div>

    <div class="editor-actions">
      <button id="deleteSegment" class="danger-btn" type="button">Delete</button>
      <button id="duplicateSegment" class="secondary-btn" type="button">Duplicate</button>
    </div>
  `;

  const bind = (id, event, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  };

  bind("screenEditType", "change", event => {
    segment.type = event.target.value;
    render();
    renderSegmentEditScreen();
  });

  bind("screenEditStart", "change", event => {
    const parsed = parseTime(event.target.value);
    if (Number.isFinite(parsed)) segment.start = Math.max(0, parsed);
    render();
    renderSegmentEditScreen();
  });

  bind("screenEditTiming", "change", event => {
    segment.endMode = event.target.value;
    render();
    renderSegmentEditScreen();
  });

  bind("screenEditDuration", "change", event => {
    segment.duration = Math.max(1, Number(event.target.value) || 1);
    render();
  });

  bind("screenEditEnd", "change", event => {
    const parsed = parseTime(event.target.value);
    if (Number.isFinite(parsed)) segment.end = Math.max(segment.start, parsed);
    render();
  });

  bind("screenEditText", "input", event => {
    segment.text = event.target.value;
    renderVisualInto(segmentCanvas, segment);
    render();
  });

  bind("segmentImageFile", "change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const label = document.querySelector(".upload-button");
    if (label) label.textContent = "Processing image...";
    try {
      segment.imageUrl = await imageFileToDataUrl(file);
      segment.imageTransform = { zoom: 1, x: 50, y: 50 };
      render();
      renderSegmentEditScreen();
    } catch (error) {
      alert(error.message || "Could not load that image.");
      renderSegmentEditScreen();
    }
  });

  bind("removeImageBtn", "click", () => {
    segment.imageUrl = "";
    delete segment.imageTransform;
    render();
    renderSegmentEditScreen();
  });

  const updateTransform = () => {
    segment.imageTransform = {
      zoom: Number(document.getElementById("imageZoom")?.value || 1),
      x: Number(document.getElementById("imageX")?.value || 50),
      y: Number(document.getElementById("imageY")?.value || 50)
    };
    renderVisualInto(segmentCanvas, segment);
    renderPreview(segment);
    renderTimeline();
  };
  bind("imageZoom", "input", updateTransform);
  bind("imageX", "input", updateTransform);
  bind("imageY", "input", updateTransform);

  bind("resetCropBtn", "click", () => {
    segment.imageTransform = { zoom: 1, x: 50, y: 50 };
    render();
    renderSegmentEditScreen();
  });

  bind("deleteSegment", "click", () => {
    state.project.segments = state.project.segments.filter(item => item.id !== segment.id);
    state.selectedId = null;
    segmentEditDialog.close();
    render();
  });

  bind("duplicateSegment", "click", () => {
    const copy = JSON.parse(JSON.stringify(segment));
    copy.id = crypto.randomUUID();
    copy.start = Math.max(0, effectiveEnd(segment));
    state.project.segments.push(copy);
    state.selectedId = copy.id;
    render();
    renderSegmentEditScreen();
  });

  enableCanvasDragging(segment);
}

function openSegmentEditor() {
  if (!state.selectedId) return;
  renderSegmentEditScreen();
  if (!segmentEditDialog.open) segmentEditDialog.showModal();
}

function enableCanvasDragging(segment) {
  if (!segment.imageUrl || !(segment.type === "image" || segment.type === "imageText")) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startPos = getTransform(segment);

  const onDown = event => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startPos = getTransform(segment);
    segmentCanvas.setPointerCapture?.(event.pointerId);
  };

  const onMove = event => {
    if (!dragging) return;
    const rect = segmentCanvas.getBoundingClientRect();
    const dx = ((event.clientX - startX) / rect.width) * 100;
    const dy = ((event.clientY - startY) / rect.height) * 100;
    segment.imageTransform = {
      zoom: startPos.zoom,
      x: Math.max(0, Math.min(100, startPos.x - dx)),
      y: Math.max(0, Math.min(100, startPos.y - dy))
    };
    const xSlider = document.getElementById("imageX");
    const ySlider = document.getElementById("imageY");
    if (xSlider) xSlider.value = segment.imageTransform.x;
    if (ySlider) ySlider.value = segment.imageTransform.y;
    renderVisualInto(segmentCanvas, segment);
    renderPreview(segment);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    renderTimeline();
  };

  segmentCanvas.onpointerdown = onDown;
  segmentCanvas.onpointermove = onMove;
  segmentCanvas.onpointerup = onUp;
  segmentCanvas.onpointercancel = onUp;
}

async function imageFileToDataUrl(file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = url;
    });

    const maxWidth = 1920;
    const maxHeight = 1920;
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function normaliseImportedProject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Project JSON must be an object.");
  if (!Array.isArray(input.segments)) throw new Error("Project JSON must contain a segments array.");
  const duration = Number(input.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Project duration must be greater than zero.");

  return {
    ...input,
    schemaVersion: Math.max(2, Number(input.schemaVersion) || 1),
    title: String(input.title || "Untitled timeline"),
    duration,
    format: input.format && Number(input.format.width) && Number(input.format.height) ? input.format : { width: 1920, height: 1080 },
    segments: input.segments.map(segment => ({
      ...segment,
      id: segment.id || crypto.randomUUID(),
      type: segment.type || "blank",
      start: Number.isFinite(Number(segment.start)) ? Math.max(0, Number(segment.start)) : 0,
      endMode: ["next", "duration", "end"].includes(segment.endMode) ? segment.endMode : "next",
      duration: Number.isFinite(Number(segment.duration)) ? Number(segment.duration) : 10,
      text: segment.text ?? "",
      imageUrl: segment.imageUrl ?? "",
      imageTransform: segment.imageTransform || { zoom: 1, x: 50, y: 50 }
    }))
  };
}

document.getElementById("newProjectBtn").addEventListener("click", () => projectDialog.showModal());
document.getElementById("cancelProjectBtn").addEventListener("click", () => projectDialog.close());
document.getElementById("addSegmentBtn").addEventListener("click", () => {
  const last = [...state.project.segments].sort((a, b) => a.start - b.start).at(-1);
  document.getElementById("segmentStartInput").value = last ? formatTime(effectiveEnd(last)) : "00:00";
  segmentDialog.showModal();
});
document.getElementById("cancelSegmentBtn").addEventListener("click", () => segmentDialog.close());
document.getElementById("closeSegmentEditBtn").addEventListener("click", () => segmentEditDialog.close());

projectDurationInput.addEventListener("change", () => {
  const parsed = parseTime(projectDurationInput.value);
  if (Number.isFinite(parsed) && parsed > 0) state.project.duration = parsed;
  render();
});

projectForm.addEventListener("submit", event => {
  event.preventDefault();
  const minutes = Math.max(0, Number(document.getElementById("minutesInput").value) || 0);
  const seconds = Math.min(59, Math.max(0, Number(document.getElementById("secondsInput").value) || 0));
  const duration = minutes * 60 + seconds;
  if (!duration) return;
  state.project = { schemaVersion: 2, title: document.getElementById("projectNameInput").value.trim() || "Untitled timeline", duration, format: { width: 1920, height: 1080 }, segments: [] };
  state.selectedId = null;
  projectDialog.close();
  render();
});

segmentForm.addEventListener("submit", event => {
  event.preventDefault();
  const parsed = parseTime(document.getElementById("segmentStartInput").value);
  const segment = {
    id: crypto.randomUUID(),
    type: document.getElementById("segmentTypeInput").value,
    start: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    endMode: "next",
    duration: 10,
    text: "",
    imageUrl: "",
    imageTransform: { zoom: 1, x: 50, y: 50 }
  };
  state.project.segments.push(segment);
  state.selectedId = segment.id;
  segmentDialog.close();
  render();
  openSegmentEditor();
});

document.getElementById("viewJsonBtn").addEventListener("click", () => {
  jsonViewOutput.value = projectJson();
  jsonViewDialog.showModal();
});
document.getElementById("closeJsonViewBtn").addEventListener("click", () => jsonViewDialog.close());

document.getElementById("importJsonBtn").addEventListener("click", () => {
  jsonImportInput.value = projectJson();
  jsonImportError.hidden = true;
  jsonImportDialog.showModal();
});
document.getElementById("cancelJsonImportBtn").addEventListener("click", () => jsonImportDialog.close());
jsonImportForm.addEventListener("submit", event => {
  event.preventDefault();
  try {
    const parsed = JSON.parse(jsonImportInput.value);
    state.project = normaliseImportedProject(parsed);
    state.selectedId = null;
    jsonImportError.hidden = true;
    jsonImportDialog.close();
    render();
  } catch (error) {
    jsonImportError.textContent = error.message || "That JSON could not be loaded.";
    jsonImportError.hidden = false;
  }
});

render();
