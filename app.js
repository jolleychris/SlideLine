const state = {
  project: {
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

const pad = value => String(value).padStart(2, "0");

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${pad(mins)}:${pad(secs)}`;
}

function parseTime(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
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
  if (segment.endMode === "duration") {
    return Math.min(state.project.duration, segment.start + (segment.duration || 0));
  }
  if (segment.endMode === "end" && Number.isFinite(segment.end)) {
    return Math.min(state.project.duration, segment.end);
  }
  const next = nextSegmentAfter(segment);
  return next ? next.start : state.project.duration;
}

function typeLabel(type) {
  return {
    image: "Image",
    text: "Text",
    imageText: "Image + text",
    blank: "Blank"
  }[type] || type;
}

function segmentSummary(segment) {
  const end = effectiveEnd(segment);
  if (segment.endMode === "next") return `${formatTime(segment.start)} · until next (${formatTime(end)})`;
  if (segment.endMode === "duration") return `${formatTime(segment.start)} · ${segment.duration}s`;
  return `${formatTime(segment.start)} · to ${formatTime(end)}`;
}

function renderTimeline() {
  sortSegments();
  projectTitle.textContent = state.project.title;
  projectMeta.textContent = `${formatTime(state.project.duration)} · ${state.project.format.width} × ${state.project.format.height}`;
  timeline.innerHTML = "";

  if (!state.project.segments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-timeline";
    empty.innerHTML = `<strong>No segments yet.</strong><p>Add the first visual at 00:00, then build downward through the episode.</p>`;
    timeline.appendChild(empty);
    return;
  }

  state.project.segments.forEach(segment => {
    const marker = document.createElement("div");
    marker.className = "time-marker";

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
      thumb.appendChild(img);
    } else {
      thumb.textContent = typeLabel(segment.type);
    }

    const copy = document.createElement("div");
    const heading = segment.title || segment.text || typeLabel(segment.type);
    copy.innerHTML = `<h4>${escapeHtml(heading)}</h4><p>${escapeHtml(segmentSummary(segment))}</p>`;

    const chip = document.createElement("div");
    chip.className = "segment-type";
    chip.textContent = typeLabel(segment.type);

    card.append(thumb, copy, chip);
    card.addEventListener("click", () => {
      state.selectedId = segment.id;
      render();
    });

    marker.append(label, card);
    timeline.appendChild(marker);
  });
}

function renderPreview(segment) {
  previewFrame.innerHTML = "";
  if (!segment) {
    previewFrame.innerHTML = `<div class="preview-placeholder">Select a segment</div>`;
    return;
  }

  if ((segment.type === "image" || segment.type === "imageText") && segment.imageUrl) {
    const img = document.createElement("img");
    img.src = segment.imageUrl;
    img.alt = "";
    previewFrame.appendChild(img);
  }

  if (segment.type === "text") {
    const text = document.createElement("div");
    text.className = "preview-text";
    text.textContent = segment.text || "Text slide";
    previewFrame.appendChild(text);
  }

  if (segment.type === "imageText") {
    const overlay = document.createElement("div");
    overlay.className = "preview-overlay";
    overlay.textContent = segment.text || "Overlay text";
    previewFrame.appendChild(overlay);
  }

  if (segment.type === "blank") {
    const blank = document.createElement("div");
    blank.className = "preview-text";
    blank.textContent = segment.text || "Blank frame";
    previewFrame.appendChild(blank);
  }
}

function renderEditor() {
  const segment = state.project.segments.find(item => item.id === state.selectedId);
  renderPreview(segment);

  if (!segment) {
    segmentEditor.className = "segment-editor empty-state";
    segmentEditor.innerHTML = `<h3>Nothing selected</h3><p>Add a segment or select one from the timeline to edit it here.</p>`;
    return;
  }

  segmentEditor.className = "segment-editor";
  segmentEditor.innerHTML = `
    <h3>Edit segment</h3>
    <label>Type
      <select id="editType">
        <option value="image" ${segment.type === "image" ? "selected" : ""}>Image</option>
        <option value="text" ${segment.type === "text" ? "selected" : ""}>Text slide</option>
        <option value="imageText" ${segment.type === "imageText" ? "selected" : ""}>Image + text</option>
        <option value="blank" ${segment.type === "blank" ? "selected" : ""}>Blank / colour</option>
      </select>
    </label>
    <label>Start time
      <input id="editStart" value="${formatTime(segment.start)}">
    </label>
    <label>Timing
      <select id="editTiming">
        <option value="next" ${segment.endMode === "next" ? "selected" : ""}>Until next segment / end</option>
        <option value="duration" ${segment.endMode === "duration" ? "selected" : ""}>Fixed duration</option>
        <option value="end" ${segment.endMode === "end" ? "selected" : ""}>Specific end time</option>
      </select>
    </label>
    <label id="durationField" ${segment.endMode === "duration" ? "" : "hidden"}>Duration (seconds)
      <input id="editDuration" type="number" min="1" value="${segment.duration || 10}">
    </label>
    <label id="endField" ${segment.endMode === "end" ? "" : "hidden"}>End time
      <input id="editEnd" value="${formatTime(segment.end ?? effectiveEnd(segment))}">
    </label>
    <label>Image URL
      <input id="editImage" value="${escapeAttribute(segment.imageUrl || "")}" placeholder="Temporary v1 URL">
    </label>
    <label>Text
      <textarea id="editText" placeholder="Slide or overlay text">${escapeHtml(segment.text || "")}</textarea>
    </label>
    <div class="editor-actions">
      <button id="deleteSegment" class="danger-btn" type="button">Delete</button>
      <button id="duplicateSegment" class="secondary-btn" type="button">Duplicate</button>
    </div>
  `;

  const bind = (id, event, fn) => document.getElementById(id).addEventListener(event, fn);

  bind("editType", "change", event => { segment.type = event.target.value; render(); });
  bind("editStart", "change", event => {
    segment.start = Math.min(state.project.duration, Math.max(0, parseTime(event.target.value)));
    render();
  });
  bind("editTiming", "change", event => { segment.endMode = event.target.value; render(); });
  bind("editDuration", "change", event => { segment.duration = Math.max(1, Number(event.target.value) || 1); render(); });
  bind("editEnd", "change", event => { segment.end = Math.max(segment.start, parseTime(event.target.value)); render(); });
  bind("editImage", "input", event => { segment.imageUrl = event.target.value; renderPreview(segment); renderTimeline(); });
  bind("editText", "input", event => { segment.text = event.target.value; renderPreview(segment); renderTimeline(); });

  bind("deleteSegment", "click", () => {
    state.project.segments = state.project.segments.filter(item => item.id !== segment.id);
    state.selectedId = null;
    render();
  });

  bind("duplicateSegment", "click", () => {
    const copy = {
      ...segment,
      id: crypto.randomUUID(),
      start: Math.min(state.project.duration, effectiveEnd(segment)),
      title: segment.title ? `${segment.title} copy` : ""
    };
    state.project.segments.push(copy);
    state.selectedId = copy.id;
    render();
  });
}

function render() {
  renderTimeline();
  renderEditor();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

document.getElementById("newProjectBtn").addEventListener("click", () => projectDialog.showModal());
document.getElementById("cancelProjectBtn").addEventListener("click", () => projectDialog.close());
document.getElementById("addSegmentBtn").addEventListener("click", () => {
  const last = [...state.project.segments].sort((a, b) => a.start - b.start).at(-1);
  document.getElementById("segmentStartInput").value = last ? formatTime(effectiveEnd(last)) : "00:00";
  segmentDialog.showModal();
});
document.getElementById("cancelSegmentBtn").addEventListener("click", () => segmentDialog.close());

projectForm.addEventListener("submit", event => {
  event.preventDefault();
  const minutes = Math.max(0, Number(document.getElementById("minutesInput").value) || 0);
  const seconds = Math.min(59, Math.max(0, Number(document.getElementById("secondsInput").value) || 0));
  const duration = minutes * 60 + seconds;
  if (!duration) return;

  state.project = {
    title: document.getElementById("projectNameInput").value.trim() || "Untitled timeline",
    duration,
    format: { width: 1920, height: 1080 },
    segments: []
  };
  state.selectedId = null;
  projectDialog.close();
  render();
});

segmentForm.addEventListener("submit", event => {
  event.preventDefault();
  const segment = {
    id: crypto.randomUUID(),
    type: document.getElementById("segmentTypeInput").value,
    start: Math.min(state.project.duration, Math.max(0, parseTime(document.getElementById("segmentStartInput").value))),
    endMode: "next",
    duration: 10,
    text: "",
    imageUrl: ""
  };
  state.project.segments.push(segment);
  state.selectedId = segment.id;
  segmentDialog.close();
  render();
});

render();
