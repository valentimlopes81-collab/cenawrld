/**
 * For the photos listed in the gallery setting "Photos to fit on mobile", find where the person is
 * inside the (often much bigger, transparent/white) photo canvas and scale + position the photo so the person
 * fills the slide width and rests on the bottom edge. All fitted photos then share the same baseline.
 * Photos listed in "Product photos to center on mobile" (data-fit-mode="center") are scaled so the product always
 * has the same size and are placed in the middle of the slide.
 * Any other gallery photo whose subject is cut off by the bottom edge of the photo (a close-up) gets
 * data-anchor-bottom, so it sits on the bottom of the slide.
 *
 * Product page gallery: mobile only. Product cards (data-fit-always): every screen size.
 * The positioning itself is pure CSS (see product-media-gallery-content.liquid / card-gallery.liquid); this script only measures the
 * photo once and writes three CSS variables on the slide: --fit-k, --fit-cx, --fit-y1.
 */
(() => {
  if (window.__cenaPhotoFit) return;
  window.__cenaPhotoFit = true;

  const mobile = window.matchMedia('(max-width: 749px)');
  const SELECTOR = 'slideshow-slide[data-photo-fit]';
  // the other photos of the mobile swipe gallery: a photo whose subject is cut off by its bottom edge (a close-up)
  // is anchored to the bottom of the slide instead of floating in the middle
  const OTHERS = 'media-gallery.media-gallery--hint slideshow-slide.product-media-container--image:not([data-photo-fit])';
  const measured = new WeakMap(); // img -> {x0,x1,y0,y1} | null
  const observed = new WeakSet();

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

  function layout(slide, img, box) {
    const W = slide.clientWidth;
    const H = slide.clientHeight;
    const fitWidth = (parseFloat(slide.dataset.fitWidth) || 96) / 100;
    const bottom = parseFloat(slide.dataset.fitBottom) || 0;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const ratio = img.naturalWidth / img.naturalHeight;

    const center = slide.dataset.fitMode === 'center';
    const maxHeight = (parseFloat(slide.dataset.fitMaxHeight) || 68) / 100;

    let k = fitWidth / bw; // photo width, as a multiple of the slide width
    if (W > 0 && H > 0) {
      // the person must also fit inside the slide height (a centred product: inside the given share of it)
      k = center ? Math.min(k, (maxHeight * H * ratio) / (bh * W)) : Math.min(k, ((H - bottom) * ratio) / (bh * W));
    }
    if (center) {
      // the middle of the product goes to the middle of the slide
      const photoHeight = (k * W) / ratio;
      slide.style.setProperty('--fit-top', (H / 2 - ((box.y0 + box.y1) / 2) * photoHeight).toFixed(1) + 'px');
    }
    slide.style.setProperty('--fit-k', k.toFixed(4));
    slide.style.setProperty('--fit-cx', ((box.x0 + box.x1) / 2).toFixed(4));
    slide.style.setProperty('--fit-y1', box.y1.toFixed(4));
    slide.style.setProperty('--fit-bottom', bottom + 'px');
    slide.setAttribute('data-fit-ready', '');
  }

  function process(slide) {
    if (!mobile.matches && !slide.hasAttribute('data-fit-always')) return;
    const img = slide.querySelector('.product-media__image');
    if (!img) return;

    const run = () => {
      let box = measured.get(img);
      if (box === undefined) {
        try {
          box = measure(img);
        } catch (e) {
          box = null; // cross-origin or unreadable: keep the default look
        }
        measured.set(img, box);
      }
      if (!box) return;
      layout(slide, img, box);
      if (!observed.has(slide) && 'ResizeObserver' in window) {
        observed.add(slide);
        new ResizeObserver(() => layout(slide, img, box)).observe(slide);
      }
    };

    img.loading = 'eager';
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }

  function anchor(slide) {
    if (!mobile.matches || slide.hasAttribute('data-anchor-checked')) return;
    const img = slide.querySelector('.product-media__image');
    if (!img) return;
    slide.setAttribute('data-anchor-checked', '');
    const run = () => {
      let box;
      try {
        box = measure(img);
      } catch (e) {
        box = null;
      }
      if (box && box.y1 > 0.985) slide.setAttribute('data-anchor-bottom', '');
    };
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach((slide) => {
      if (!slide.hasAttribute('data-fit-ready')) process(slide);
    });
    document.querySelectorAll(OTHERS).forEach(anchor);
  }

  scan();
  document.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', scan);
  mobile.addEventListener('change', scan);
  // the gallery is re-rendered when a variant is picked
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
