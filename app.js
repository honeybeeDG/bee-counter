const STORAGE_KEY = "bee-counter-line-v3";

const state = {
  frames: loadFrames(),
  pendingImage: null,
  pendingImageName: "bee-frame.jpg",
  roi: defaultRoi(),
  lines: [],
  mode: "roi",
  dragStart: null,
  activeLine: null,
  paintMask: null,
  painting: false,
  lastPaintPoint: null,
};

const els = {
  photoInput: document.querySelector("#photoInput"),
  previewWrap: document.querySelector("#previewWrap"),
  previewCanvas: document.querySelector("#previewCanvas"),
  captureForm: document.querySelector("#captureForm"),
  frameName: document.querySelector("#frameName"),
  frameSide: document.querySelector("#frameSide"),
  boxPadding: document.querySelector("#boxPadding"),
  coverageValue: document.querySelector("#coverageValue"),
  fullFrameBees: document.querySelector("#fullFrameBees"),
  fullFrameValue: document.querySelector("#fullFrameValue"),
  areaEstimate: document.querySelector("#areaEstimate"),
  areaEstimator: document.querySelector("#areaEstimator"),
  frameList: document.querySelector("#frameList"),
  frameTemplate: document.querySelector("#frameItemTemplate"),
  totalBees: document.querySelector("#totalBees"),
  frameCount: document.querySelector("#frameCount"),
  lineCount: document.querySelector("#lineCount"),
  emptyState: document.querySelector("#emptyState"),
  exportBtn: document.querySelector("#exportBtn"),
  shareBtn: document.querySelector("#shareBtn"),
  resetHiveBtn: document.querySelector("#resetHiveBtn"),
  lineTools: document.querySelector("#lineTools"),
  roiModeBtn: document.querySelector("#roiModeBtn"),
  paintModeBtn: document.querySelector("#paintModeBtn"),
  erasePaintModeBtn: document.querySelector("#erasePaintModeBtn"),
  lineModeBtn: document.querySelector("#lineModeBtn"),
  deleteModeBtn: document.querySelector("#deleteModeBtn"),
  undoLineBtn: document.querySelector("#undoLineBtn"),
  resetRoiBtn: document.querySelector("#resetRoiBtn"),
  clearPaintBtn: document.querySelector("#clearPaintBtn"),
  clearLinesBtn: document.querySelector("#clearLinesBtn"),
  exportYoloBtn: document.querySelector("#exportYoloBtn"),
  exportDirectionBtn: document.querySelector("#exportDirectionBtn"),
  zoomLevel: document.querySelector("#zoomLevel"),
  saveFrameBtn: document.querySelector("#saveFrameBtn"),
  imageModal: document.querySelector("#imageModal"),
  modalImage: document.querySelector("#modalImage"),
  modalTitle: document.querySelector("#modalTitle"),
  modalMeta: document.querySelector("#modalMeta"),
  modalCloseBtn: document.querySelector("#modalCloseBtn"),
};

render();
setMode("roi");
updateAreaEstimate();

els.photoInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  state.pendingImage = await fileToImage(file);
  state.pendingImageName = file.name || "bee-frame.jpg";
  state.roi = defaultRoi();
  state.lines = [];
  state.activeLine = null;
  els.zoomLevel.value = "100";
  setupCanvasSize();
  resetPaintMask();
  setMode("roi");
  updateAreaEstimate();
  drawPreview();
  els.previewWrap.hidden = false;
  els.lineTools.hidden = false;
  els.areaEstimator.hidden = false;
  els.saveFrameBtn.disabled = false;
  updateLineCount();
});

els.previewCanvas.addEventListener("pointerdown", (event) => {
  if (!state.pendingImage) return;
  event.preventDefault();
  els.previewCanvas.setPointerCapture(event.pointerId);
  const point = getCanvasPoint(event);

  if (state.mode === "roi") {
    state.dragStart = point;
    return;
  }

  if (state.mode === "delete") {
    deleteNearestLine(point);
    return;
  }

  if ((state.mode === "paint" || state.mode === "erasePaint") && pointInRoi(point)) {
    state.painting = true;
    state.lastPaintPoint = point;
    paintBeeArea(point, point, state.mode === "erasePaint");
    return;
  }

  if (state.mode === "line" && pointInRoi(point)) {
    state.activeLine = { head: point, tail: point };
    drawPreview();
  }
});

els.previewCanvas.addEventListener("pointermove", (event) => {
  if (!state.pendingImage) return;
  const point = getCanvasPoint(event);

  if (state.mode === "roi" && state.dragStart) {
    event.preventDefault();
    state.roi = normalizeRoi({
      x: Math.min(state.dragStart.x, point.x),
      y: Math.min(state.dragStart.y, point.y),
      w: Math.abs(point.x - state.dragStart.x),
      h: Math.abs(point.y - state.dragStart.y),
    });
    drawPreview();
    return;
  }

  if (state.mode === "line" && state.activeLine) {
    event.preventDefault();
    state.activeLine.tail = point;
    drawPreview();
    return;
  }

  if ((state.mode === "paint" || state.mode === "erasePaint") && state.painting) {
    event.preventDefault();
    paintBeeArea(state.lastPaintPoint || point, point, state.mode === "erasePaint");
    state.lastPaintPoint = point;
  }
});

els.previewCanvas.addEventListener("pointerup", () => {
  if (state.mode === "line" && state.activeLine) {
    const line = state.activeLine;
    if (lineLength(line) > 0.006 && pointInRoi(line.head) && pointInRoi(line.tail)) {
      state.lines.push(line);
      updateLineCount();
    }
    state.activeLine = null;
    drawPreview();
  }
  state.dragStart = null;
  state.painting = false;
  state.lastPaintPoint = null;
});

els.previewCanvas.addEventListener("pointercancel", () => {
  state.dragStart = null;
  state.activeLine = null;
  state.painting = false;
  state.lastPaintPoint = null;
  drawPreview();
});

els.roiModeBtn.addEventListener("click", () => setMode("roi"));
els.paintModeBtn.addEventListener("click", () => setMode("paint"));
els.erasePaintModeBtn.addEventListener("click", () => setMode("erasePaint"));
els.lineModeBtn.addEventListener("click", () => setMode("line"));
els.deleteModeBtn.addEventListener("click", () => setMode("delete"));
els.undoLineBtn.addEventListener("click", () => {
  state.lines.pop();
  drawPreview();
  updateLineCount();
});

els.resetRoiBtn.addEventListener("click", () => {
  state.roi = defaultRoi();
  updateAreaEstimate();
  drawPreview();
});

els.clearPaintBtn.addEventListener("click", () => {
  if (!state.paintMask) return;
  if (!confirm("현재 사진에 칠한 꿀벌 면적을 모두 지울까요?")) return;
  resetPaintMask();
  updateAreaEstimate();
  drawPreview();
});

els.clearLinesBtn.addEventListener("click", () => {
  if (!state.lines.length) return;
  if (!confirm("현재 사진의 방향선을 모두 지울까요?")) return;
  state.lines = [];
  drawPreview();
  updateLineCount();
});

els.zoomLevel.addEventListener("input", applyZoom);
els.fullFrameBees.addEventListener("input", updateAreaEstimate);

els.exportYoloBtn.addEventListener("click", () => {
  if (!state.pendingImage) return;
  downloadText(currentYoloText(), labelFileName(state.pendingImageName));
});

els.exportDirectionBtn.addEventListener("click", () => {
  if (!state.pendingImage) return;
  downloadText(JSON.stringify(currentDirectionLabels(), null, 2), directionFileName(state.pendingImageName));
});

els.captureForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.pendingImage) return;

  const sequence = state.frames.length + 1;
  const areaEstimate = currentAreaEstimate();
  const countMethod = state.lines.length ? "방향선 라벨" : "면적 추정";
  const title = els.frameName.value.trim() || `${sequence}번 ${els.frameSide.value}`;
  const frame = {
    id: createId(),
    title,
    side: els.frameSide.value,
    image: renderLineOverlay(),
    count: state.lines.length || areaEstimate,
    countMethod,
    areaEstimate,
    coverage: currentCoveragePercent(),
    fullFrameBees: Number(els.fullFrameBees.value),
    lines: [...state.lines],
    yolo: currentYoloText(),
    directionLabels: currentDirectionLabels(),
    sourceName: state.pendingImageName,
    capturedAt: new Date().toISOString(),
  };

  state.frames.push(frame);
  saveFrames();
  resetPendingPhoto();
  render();
});

els.frameList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-button");
  if (removeButton) {
    state.frames = state.frames.filter((frame) => frame.id !== removeButton.dataset.id);
    saveFrames();
    render();
    return;
  }

  const yoloButton = event.target.closest(".download-yolo");
  if (yoloButton) {
    const frame = findFrame(yoloButton.dataset.id);
    if (frame) downloadText(frame.yolo || "", labelFileName(frame.sourceName || frame.title));
    return;
  }

  const directionButton = event.target.closest(".download-direction");
  if (directionButton) {
    const frame = findFrame(directionButton.dataset.id);
    if (frame) downloadText(JSON.stringify(frame.directionLabels || emptyDirectionLabels(frame), null, 2), directionFileName(frame.sourceName || frame.title));
    return;
  }

  const imageButton = event.target.closest(".image-button");
  if (imageButton) {
    const frame = findFrame(imageButton.dataset.id);
    if (frame) openImageModal(frame);
  }
});

els.resetHiveBtn.addEventListener("click", () => {
  if (!state.frames.length) return;
  if (!confirm("현재 벌통의 소비 기록을 모두 삭제할까요?")) return;
  state.frames = [];
  saveFrames();
  render();
});

els.exportBtn.addEventListener("click", () => {
  downloadCsv(toCsv(state.frames), `bee-hive-count-${new Date().toISOString().slice(0, 10)}.csv`);
});

els.shareBtn.addEventListener("click", async () => {
  const text = makeSummaryText();
  if (navigator.share) {
    await navigator.share({ title: "꿀벌 수 측정 결과", text });
    return;
  }
  await navigator.clipboard.writeText(text);
  alert("요약을 클립보드에 복사했습니다.");
});

els.modalCloseBtn.addEventListener("click", closeImageModal);
els.imageModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeImageModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.imageModal.hidden) closeImageModal();
});

function setupCanvasSize() {
  const image = state.pendingImage;
  const canvas = els.previewCanvas;
  const maxWidth = 1600;
  const scale = Math.min(maxWidth / image.width, 1);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  applyZoom();
}

function resetPaintMask() {
  const canvas = els.previewCanvas;
  state.paintMask = document.createElement("canvas");
  state.paintMask.width = canvas.width;
  state.paintMask.height = canvas.height;
}

function applyZoom() {
  const zoom = Number(els.zoomLevel.value || 100);
  els.previewCanvas.style.width = zoom === 100 ? "100%" : `${zoom}%`;
}

function updateAreaEstimate() {
  const coverage = currentCoveragePercent();
  const fullFrame = Number(els.fullFrameBees.value || 2300);
  els.coverageValue.textContent = `${coverage.toFixed(1)}%`;
  els.fullFrameValue.textContent = `${fullFrame.toLocaleString("ko-KR")}마리`;
  els.areaEstimate.textContent = currentAreaEstimate().toLocaleString("ko-KR");
}

function currentAreaEstimate() {
  return Math.round(Number(els.fullFrameBees.value || 2300) * currentCoveragePercent() / 100);
}

function currentCoveragePercent() {
  if (!state.paintMask || !state.pendingImage) return 0;
  const maskCtx = state.paintMask.getContext("2d");
  const bounds = roiToPixels(state.roi, state.paintMask.width, state.paintMask.height);
  const w = Math.max(1, bounds.right - bounds.left);
  const h = Math.max(1, bounds.bottom - bounds.top);
  const data = maskCtx.getImageData(bounds.left, bounds.top, w, h).data;
  let painted = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 20) painted += 1;
  }
  return Math.min(100, painted / (w * h) * 100);
}

function paintBeeArea(from, to, erase) {
  if (!state.paintMask) resetPaintMask();
  const ctx = state.paintMask.getContext("2d");
  const width = state.paintMask.width;
  const height = state.paintMask.height;
  const bounds = roiToPixels(state.roi, width, height);
  const brush = Math.max(16, Math.round(Math.min(width, height) / 35));

  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.clip();
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.strokeStyle = "rgba(0, 190, 92, 1)";
  ctx.lineWidth = brush;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * width, from.y * height);
  ctx.lineTo(to.x * width, to.y * height);
  ctx.stroke();
  ctx.restore();

  updateAreaEstimate();
  drawPreview();
}

function drawPaintMask(ctx, width, height) {
  if (!state.paintMask) return;

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.drawImage(state.paintMask, 0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);

  const maskCtx = state.paintMask.getContext("2d");
  const step = Math.max(18, Math.round(width / 45));
  const data = maskCtx.getImageData(0, 0, state.paintMask.width, state.paintMask.height).data;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const mx = Math.min(state.paintMask.width - 1, Math.round(x / width * state.paintMask.width));
      const my = Math.min(state.paintMask.height - 1, Math.round(y / height * state.paintMask.height));
      const alpha = data[(my * state.paintMask.width + mx) * 4 + 3];
      if (alpha > 20) {
        ctx.beginPath();
        ctx.moveTo(x - step * 0.35, y + step * 0.35);
        ctx.lineTo(x + step * 0.35, y - step * 0.35);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPreview() {
  const image = state.pendingImage;
  if (!image) return;

  const canvas = els.previewCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const bounds = roiToPixels(state.roi, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(0, 0, canvas.width, bounds.top);
  ctx.fillRect(0, bounds.bottom, canvas.width, canvas.height - bounds.bottom);
  ctx.fillRect(0, bounds.top, bounds.left, bounds.bottom - bounds.top);
  ctx.fillRect(bounds.right, bounds.top, canvas.width - bounds.right, bounds.bottom - bounds.top);
  ctx.restore();

  drawRoiOutline(ctx, bounds);
  drawPaintMask(ctx, canvas.width, canvas.height);
  drawLines(ctx, canvas.width, canvas.height);
  if (state.activeLine) drawSingleLine(ctx, state.activeLine, canvas.width, canvas.height, state.lines.length + 1, true);
}

function drawRoiOutline(ctx, bounds) {
  ctx.save();
  ctx.strokeStyle = "#00be5c";
  ctx.lineWidth = Math.max(2, Math.round(ctx.canvas.width / 420));
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bounds.left + 4, bounds.top + 4, Math.max(1, bounds.right - bounds.left - 8), Math.max(1, bounds.bottom - bounds.top - 8));
  ctx.restore();
}

function drawLines(ctx, width, height) {
  state.lines.forEach((line, index) => {
    drawSingleLine(ctx, line, width, height, index + 1, false);
  });
}

function drawSingleLine(ctx, line, width, height, index, isDraft) {
  const hx = line.head.x * width;
  const hy = line.head.y * height;
  const tx = line.tail.x * width;
  const ty = line.tail.y * height;
  const r = Math.max(2.5, width / 520);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = isDraft ? "rgba(0, 190, 92, 0.55)" : "#00be5c";
  ctx.lineWidth = Math.max(1.5, width / 700);
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  drawArrowHead(ctx, hx, hy, tx, ty, Math.max(4, width / 260));

  ctx.fillStyle = "#00be5c";
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(7, Math.round(width / 190))}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("H", hx, hy);

  ctx.fillStyle = "#102218";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.font = `bold ${Math.max(8, Math.round(width / 130))}px system-ui`;
  ctx.strokeText(String(index), hx, hy - r - 7);
  ctx.fillText(String(index), hx, hy - r - 7);
  ctx.restore();
}

function drawArrowHead(ctx, hx, hy, tx, ty, size) {
  const angle = Math.atan2(ty - hy, tx - hx);
  if (!Number.isFinite(angle)) return;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - size * Math.cos(angle - Math.PI / 6), ty - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tx - size * Math.cos(angle + Math.PI / 6), ty - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function deleteNearestLine(point) {
  if (!state.lines.length) return;
  let bestIndex = -1;
  let bestDistance = Infinity;
  state.lines.forEach((line, index) => {
    const distance = distanceToSegment(point, line.head, line.tail);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex >= 0 && bestDistance < 0.035) {
    state.lines.splice(bestIndex, 1);
    drawPreview();
    updateLineCount();
  }
}

function renderLineOverlay() {
  const image = state.pendingImage;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const maxSide = 1200;
  const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const bounds = roiToPixels(state.roi, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(0, 0, canvas.width, bounds.top);
  ctx.fillRect(0, bounds.bottom, canvas.width, canvas.height - bounds.bottom);
  ctx.fillRect(0, bounds.top, bounds.left, bounds.bottom - bounds.top);
  ctx.fillRect(bounds.right, bounds.top, canvas.width - bounds.right, bounds.bottom - bounds.top);
  ctx.restore();
  drawRoiOutline(ctx, bounds);
  drawPaintMask(ctx, canvas.width, canvas.height);
  drawLines(ctx, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function currentYoloText() {
  const pad = Number(els.boxPadding.value) / Math.max(els.previewCanvas.width, els.previewCanvas.height);
  return state.lines
    .map((line) => {
      const left = Math.min(line.head.x, line.tail.x) - pad;
      const right = Math.max(line.head.x, line.tail.x) + pad;
      const top = Math.min(line.head.y, line.tail.y) - pad;
      const bottom = Math.max(line.head.y, line.tail.y) + pad;
      const x1 = clamp(left, 0, 1);
      const x2 = clamp(right, 0, 1);
      const y1 = clamp(top, 0, 1);
      const y2 = clamp(bottom, 0, 1);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const w = Math.max(0.006, x2 - x1);
      const h = Math.max(0.006, y2 - y1);
      return `0 ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
    })
    .join("\n");
}

function currentDirectionLabels() {
  return {
    image: state.pendingImageName,
    imageWidth: els.previewCanvas.width,
    imageHeight: els.previewCanvas.height,
    areaEstimate: currentAreaEstimate(),
    coverage: currentCoveragePercent(),
    fullFrameBees: Number(els.fullFrameBees.value),
    labels: state.lines.map((line, index) => ({
      class: "bee",
      index: index + 1,
      head: { x: round6(line.head.x), y: round6(line.head.y) },
      tail: { x: round6(line.tail.x), y: round6(line.tail.y) },
      length: round6(lineLength(line)),
    })),
  };
}

function emptyDirectionLabels(frame) {
  return {
    image: frame.sourceName || frame.title,
    areaEstimate: frame.areaEstimate || frame.count || 0,
    coverage: frame.coverage ?? null,
    fullFrameBees: frame.fullFrameBees ?? null,
    labels: [],
  };
}

function getCanvasPoint(event) {
  const rect = els.previewCanvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function pointInRoi(point) {
  return point.x >= state.roi.x &&
    point.x <= state.roi.x + state.roi.w &&
    point.y >= state.roi.y &&
    point.y <= state.roi.y + state.roi.h;
}

function normalizeRoi(roi) {
  const minSize = 0.08;
  const w = Math.max(minSize, roi.w);
  const h = Math.max(minSize, roi.h);
  return {
    x: clamp(roi.x, 0, 1 - w),
    y: clamp(roi.y, 0, 1 - h),
    w: clamp(w, minSize, 1),
    h: clamp(h, minSize, 1),
  };
}

function defaultRoi() {
  return { x: 0.05, y: 0.16, w: 0.9, h: 0.68 };
}

function roiToPixels(roi, width, height) {
  return {
    left: Math.max(0, Math.round(roi.x * width)),
    top: Math.max(0, Math.round(roi.y * height)),
    right: Math.min(width, Math.round((roi.x + roi.w) * width)),
    bottom: Math.min(height, Math.round((roi.y + roi.h) * height)),
  };
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function lineLength(line) {
  return Math.hypot(line.tail.x - line.head.x, line.tail.y - line.head.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round6(value) {
  return Number(value.toFixed(6));
}

function setMode(mode) {
  state.mode = mode;
  els.roiModeBtn.classList.toggle("active", mode === "roi");
  els.paintModeBtn.classList.toggle("active", mode === "paint");
  els.erasePaintModeBtn.classList.toggle("active", mode === "erasePaint");
  els.lineModeBtn.classList.toggle("active", mode === "line");
  els.deleteModeBtn.classList.toggle("active", mode === "delete");
}

function updateLineCount() {
  els.lineCount.textContent = state.lines.length.toLocaleString("ko-KR");
}

function openImageModal(frame) {
  const labels = frame.lines ?? frame.points ?? [];
  els.modalImage.src = frame.image;
  els.modalImage.alt = `${frame.title} 라벨 사진`;
  els.modalTitle.textContent = frame.title;
  els.modalMeta.textContent = `${frame.count.toLocaleString("ko-KR")}마리 · 라벨 ${labels.length}개 · ${frame.countMethod || "기록"}`;
  els.imageModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeImageModal() {
  els.imageModal.hidden = true;
  els.modalImage.removeAttribute("src");
  document.body.classList.remove("modal-open");
}

function resetPendingPhoto() {
  state.pendingImage = null;
  state.pendingImageName = "bee-frame.jpg";
  state.roi = defaultRoi();
  state.lines = [];
  state.dragStart = null;
  state.activeLine = null;
  state.paintMask = null;
  state.painting = false;
  state.lastPaintPoint = null;
  els.photoInput.value = "";
  els.frameName.value = "";
  els.previewWrap.hidden = true;
  els.lineTools.hidden = true;
  els.areaEstimator.hidden = true;
  els.saveFrameBtn.disabled = true;
  els.zoomLevel.value = "100";
  applyZoom();
  setMode("roi");
  updateLineCount();
  updateAreaEstimate();
}

function render() {
  const total = state.frames.reduce((sum, frame) => sum + frame.count, 0);
  els.totalBees.textContent = total.toLocaleString("ko-KR");
  els.frameCount.textContent = state.frames.length.toLocaleString("ko-KR");
  els.emptyState.hidden = state.frames.length > 0;
  els.exportBtn.disabled = state.frames.length === 0;
  els.shareBtn.disabled = state.frames.length === 0;

  els.frameList.innerHTML = "";
  for (const frame of state.frames) {
    const labels = frame.lines ?? frame.points ?? [];
    const item = els.frameTemplate.content.cloneNode(true);
    const imageButton = item.querySelector(".image-button");
    imageButton.dataset.id = frame.id;
    imageButton.title = "라벨 사진 크게 보기";
    imageButton.querySelector("img").src = frame.image;
    imageButton.querySelector("img").alt = `${frame.title} 라벨 사진`;
    item.querySelector(".frame-title").textContent = frame.title;
    item.querySelector(".bee-count").textContent = frame.count.toLocaleString("ko-KR");
    item.querySelector(".label-count").textContent = labels.length.toLocaleString("ko-KR");
    item.querySelector(".count-method").textContent = frame.countMethod || "기록";
    item.querySelector(".frame-advice").textContent = `${frame.sourceName}에서 만든 ${frame.countMethod || "라벨"}입니다.`;
    item.querySelector(".remove-button").dataset.id = frame.id;
    item.querySelector(".download-yolo").dataset.id = frame.id;
    item.querySelector(".download-direction").dataset.id = frame.id;
    item.querySelector(".download-yolo").disabled = !frame.yolo;
    els.frameList.appendChild(item);
  }
  updateLineCount();
}

function findFrame(id) {
  return state.frames.find((frame) => frame.id === id);
}

function loadFrames() {
  const keys = [STORAGE_KEY, "bee-counter-line-v2", "bee-counter-line-v1", "bee-counter-point-v1"];
  try {
    for (const key of keys) {
      const frames = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(frames) && frames.length) return frames;
    }
    return [];
  } catch {
    return [];
  }
}

function saveFrames() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.frames));
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `frame-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function labelFileName(imageName) {
  return `${imageName.replace(/\.[^.]+$/, "") || "bee-frame"}.txt`;
}

function directionFileName(imageName) {
  return `${imageName.replace(/\.[^.]+$/, "") || "bee-frame"}-direction.json`;
}

function downloadText(text, filename) {
  const blob = new Blob([text ? `${text}\n` : ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(text, filename) {
  const blob = new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(frames) {
  const headers = ["소비", "면", "개체수", "계수방식", "라벨수", "면적추정", "덮은비율", "가득찼을때기준", "원본파일", "촬영시각"];
  const rows = frames.map((frame) => [
    frame.title,
    frame.side,
    frame.count,
    frame.countMethod || "기록",
    (frame.lines ?? frame.points ?? []).length,
    frame.areaEstimate ?? "",
    frame.coverage ?? "",
    frame.fullFrameBees ?? "",
    frame.sourceName,
    frame.capturedAt,
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

function makeSummaryText() {
  const total = state.frames.reduce((sum, frame) => sum + frame.count, 0);
  return `벌통 일벌 계수: ${total.toLocaleString("ko-KR")}마리\n촬영 소비 면: ${state.frames.length}면`;
}
