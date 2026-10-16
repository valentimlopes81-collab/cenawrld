/**
 * Homepage product grid: make every cover photo show its product at about the same size.
 * Finds where the product is inside each photo (transparent or white canvas), then scales and centres
 * the photo so the product fills the same box in every card. Without JS the cards keep the plain CSS look.
 */
(() => {
  if (window.__cenaHomeGridFit) return;
  window.__cenaHomeGridFit = true;

  const SIZE = 0.82; // target "size" of the product (geometric mean of its width and height), as a share of the card width
  const MAX_W = 0.86; // the product never gets wider than this share of the card width
  const MAX_H = 0.82; // ...or taller than this share of the card height

  /** Bounding box of the visible subject, as fractions (0..1) of the photo. */
  function measure(img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return null;
    const scale = Math.min(1, 320 / Math.max(nw, nh));
    const w = Math.max(8, Math.round(nw * scale));
    const h = Math.max(8, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data; // throws if the image is cross-origin

    let hasAlpha = false;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 250) {
        hasAlpha = true;
        break;
      }
    }
    const isSubject = hasAlpha
      ? (i) => d[i + 3] > 24
      : (i) => !(d[i] >= 246 && d[i + 1] >= 246 && d[i + 2] >= 246);

    const rows = new Uint16Array(h);
    const cols = new Uint16Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isSubject((y * w + x) * 4)) {
          rows[y]++;
          cols[x]++;
        }
      }
    }
    const minRow = Math.max(2, Math.round(w * 0.006));
    const minCol = Math.max(2, Math.round(h * 0.006));
    const first = (a, min) => a.findIndex((v) => v >= min);
    const last = (a, min) => {
      for (let i = a.length - 1; i >= 0; i--) if (a[i] >= min) return i;
      return -1;
    };
    const y0 = first(rows, minRow);
    const y1 = last(rows, minRow);
    const x0 = first(cols, minCol);
    const x1 = last(cols, minCol);
    if (y0 < 0 || x0 < 0 || y1 <= y0 || x1 <= x0) return null;

    const box = { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    // nothing to trim: leave the photo exactly as it is
    if (box.x1 - box.x0 > 0.97 && box.y1 - box.y0 > 0.97) return null;
    return box;
  }

  function layout(media, img, box) {
    const W = media.clientWidth;
    const H = media.clientHeight;
    if (!W || !H) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    // photo width / card width: same visual size for every product, within the caps
    const k = Math.min(SIZE / Math.sqrt((bw * bh) / ratio), MAX_W / bw, (MAX_H * H * ratio) / (bh * W));
    const pw = k * W;
    const ph = pw / ratio;
    media.style.setProperty('--hg-w', pw.toFixed(1) + 'px');
    media.style.setProperty('--hg-h', ph.toFixed(1) + 'px');
    media.style.setProperty('--hg-x', (W / 2 - ((box.x0 + box.x1) / 2) * pw).toFixed(1) + 'px');
    media.style.setProperty('--hg-y', (H / 2 - ((box.y0 + box.y1) / 2) * ph).toFixed(1) + 'px');
    media.setAttribute('data-fit-ready', '');
  }

  function process(media) {
    const img = media.querySelector('img');
    if (!img || media.hasAttribute('data-fit-done')) return;
    media.setAttribute('data-fit-done', '');
    const apply = (box) => {
      if (!box) return;
      layout(media, img, box);
      if ('ResizeObserver' in window) new ResizeObserver(() => layout(media, img, box)).observe(media);
    };
    const run = () => {
      // measure a CORS-enabled copy of the photo: the displayed one would taint the canvas
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = () => {
        try {
          apply(measure(probe));
        } catch (e) {
          /* unreadable: keep the default look */
        }
      };
      probe.onerror = () => {
        try {
          apply(measure(img));
        } catch (e) {
          /* unreadable: keep the default look */
        }
      };
      probe.src = img.currentSrc || img.src;
    };
    img.loading = 'eager';
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }

  const scan = () => document.querySelectorAll('.home-grid__media').forEach(process);
  scan();
  document.addEventListener('DOMContentLoaded', scan);
})();
