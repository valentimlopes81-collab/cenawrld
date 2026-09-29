/**
 * Desktop thumbnail rail for the stacked product gallery.
 *
 * Builds a column of small thumbnails from the photos already on the page,
 * pins it to the left of the gallery while the photos scroll, highlights the
 * photo currently in view, and scrolls to a photo when its thumbnail is clicked.
 * Runs on desktop widths only (mobile keeps the theme's own carousel).
 */

const DESKTOP_QUERY = '(min-width: 750px)';
const RAIL_SELECTOR = '.media-gallery__grid[data-scroll-rail]';
const THUMB_SIZE = 66;
const THUMB_GAP = 20;
const RAIL_EDGE = 16;
const RAIL_TO_PHOTOS_GAP = 16;

function getHeaderBottom() {
  const header = document.getElementById('header-group');
  return header ? header.getBoundingClientRect().bottom : 0;
}

function thumbUrl(img) {
  const src = img.currentSrc || img.getAttribute('src') || '';
  if (!src) return '';
  if (/[?&]width=\d+/.test(src)) return src.replace(/([?&])width=\d+/, '$1width=160');
  return src;
}

class GalleryRail {
  /** @param {HTMLElement} grid */
  constructor(grid) {
    this.grid = grid;
    this.items = Array.from(grid.children).filter((child) => child.tagName === 'LI');
    this.thumbs = [];
    this.activeIndex = -1;
    this.ticking = false;

    this.rail = document.createElement('nav');
    this.rail.className = 'product-gallery-rail';
    this.rail.setAttribute('aria-label', 'Product photos');
    Object.assign(this.rail.style, {
      position: 'fixed',
      left: `${RAIL_EDGE}px`,
      top: '0px',
      zIndex: '4',
      display: 'none',
      flexDirection: 'column',
      gap: `${THUMB_GAP}px`,
      width: `${THUMB_SIZE}px`,
      overflowY: 'auto',
      scrollbarWidth: 'none',
      padding: '2px',
      boxSizing: 'content-box',
    });

    this.items.forEach((item, index) => {
      const img = item.querySelector('img');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Photo ${index + 1}`);
      Object.assign(button.style, {
        display: 'block',
        flex: '0 0 auto',
        width: `${THUMB_SIZE}px`,
        height: `${THUMB_SIZE}px`,
        padding: '0',
        margin: '0',
        border: '1px solid transparent',
        background: 'rgba(0,0,0,0.06)',
        cursor: 'pointer',
        overflow: 'hidden',
        lineHeight: '0',
      });

      if (img) {
        const thumb = document.createElement('img');
        thumb.src = thumbUrl(img);
        thumb.alt = '';
        thumb.loading = 'lazy';
        Object.assign(thumb.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
        button.appendChild(thumb);
      }

      button.addEventListener('click', () => this.scrollToItem(index));
      this.thumbs.push(button);
      this.rail.appendChild(button);
    });

    document.body.appendChild(this.rail);
    this.reserveSpace();
    this.update();
  }

  destroy() {
    this.rail.remove();
  }

  isConnected() {
    return this.grid.isConnected;
  }

  /** Make sure the photos start to the right of the rail, whatever the page layout is. */
  reserveSpace() {
    const container = this.grid.closest('.product-information__media') || this.grid.parentElement;
    if (!container) return;
    container.style.paddingLeft = '';
    const needed = RAIL_EDGE + THUMB_SIZE + 4 + RAIL_TO_PHOTOS_GAP;
    const gridLeft = this.grid.getBoundingClientRect().left;
    if (gridLeft < needed) {
      const current = parseFloat(getComputedStyle(container).paddingLeft) || 0;
      container.style.paddingLeft = `${current + (needed - gridLeft)}px`;
    }
  }

  scrollToItem(index) {
    const item = this.items[index];
    if (!item) return;
    const offset = getHeaderBottom() + 16;
    const top = item.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  update() {
    const headerBottom = getHeaderBottom();
    const gridRect = this.grid.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const visible = gridRect.bottom > headerBottom + 40 && gridRect.top < viewportHeight - 40;
    this.rail.style.display = visible ? 'flex' : 'none';
    if (!visible) return;

    const maxHeight = viewportHeight - headerBottom - 32;
    this.rail.style.maxHeight = `${maxHeight}px`;
    const railHeight = Math.min(this.rail.scrollHeight, maxHeight);

    let top = Math.max(headerBottom + 16, gridRect.top);
    top = Math.min(top, gridRect.bottom - railHeight);
    this.rail.style.top = `${top}px`;

    this.updateActive(headerBottom, viewportHeight);
  }

  updateActive(headerBottom, viewportHeight) {
    const focusLine = headerBottom + (viewportHeight - headerBottom) * 0.4;
    let best = 0;
    let bestDistance = Infinity;

    this.items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      if (rect.top <= focusLine && rect.bottom >= focusLine) {
        best = index;
        bestDistance = -1;
      } else if (bestDistance >= 0) {
        const distance = Math.min(Math.abs(rect.top - focusLine), Math.abs(rect.bottom - focusLine));
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      }
    });

    if (best === this.activeIndex) return;
    this.activeIndex = best;

    this.thumbs.forEach((thumb, index) => {
      const active = index === best;
      thumb.style.borderColor = active ? '#000' : 'transparent';
      thumb.setAttribute('aria-current', active ? 'true' : 'false');
    });

    const activeThumb = this.thumbs[best];
    if (activeThumb) {
      const railRect = this.rail.getBoundingClientRect();
      const thumbRect = activeThumb.getBoundingClientRect();
      if (thumbRect.top < railRect.top) this.rail.scrollTop -= railRect.top - thumbRect.top + 8;
      else if (thumbRect.bottom > railRect.bottom) this.rail.scrollTop += thumbRect.bottom - railRect.bottom + 8;
    }
  }
}

let current = null;

function sync() {
  const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
  const grid = document.querySelector(RAIL_SELECTOR);
  const enabled = grid && grid.dataset.scrollRail !== 'false' && grid.children.length > 1;

  if (current && (!isDesktop || !enabled || !current.isConnected() || current.grid !== grid)) {
    current.destroy();
    current = null;
  }

  if (!current && isDesktop && enabled) current = new GalleryRail(grid);
  if (current) current.update();
}

function onFrame() {
  sync();
  scheduled = false;
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(onFrame);
}

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', () => {
  if (current) current.reserveSpace();
  schedule();
});
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
else sync();
