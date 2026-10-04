/**
 * Size recommendation pop-up. (v2) Reads the "Size rule" blocks, then updates the recommended sizes live
 * as the customer moves the height and weight sliders.
 */
if (!customElements.get('size-guide')) {
  class SizeGuide extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('dialog');
      const row = this.previousElementSibling;
      this.row = row && row.matches('accordion-custom') ? row : null;
      this.details = this.row && this.row.querySelector('[data-size-guide-details]');
      this.rules = this.readRules();

      this.hIn = this.querySelector('[data-height-input]');
      this.wIn = this.querySelector('[data-weight-input]');
      this.update = this.update.bind(this);
      this.hIn.addEventListener('input', this.update);
      this.wIn.addEventListener('input', this.update);

      if (this.details) {
        // open the pop-up instead of expanding the accordion row
        this.details.addEventListener(
          'click',
          (e) => {
            if (!e.target.closest('summary')) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            this.open();
          },
          true
        );
        this.details.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('summary')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.open();
          }
        }, true);
      }
      this.querySelector('[data-size-guide-close]').addEventListener('click', () => this.dialog.close());
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) this.dialog.close(); // click on the dark backdrop
      });
      this.update();
    }

    readRules() {
      const num = (v) => (v === '' || v == null ? NaN : Number(v));
      const own = Array.from(this.querySelectorAll('[data-size-rule]')).map((el) => ({
        hf: num(el.dataset.heightFrom),
        ht: num(el.dataset.heightTo),
        wf: num(el.dataset.weightFrom),
        wt: num(el.dataset.weightTo),
        s1: el.dataset['size-1'] || '',
        s2: el.dataset['size-2'] || '',
        text: el.dataset.text || '',
      }));
      // product-specific "Size rule" blocks win; otherwise use the generic chart
      return own.length ? own : this.readGenericRules();
    }

    /** Lines like "168-176 | 65-78 | M | L | optional text". */
    readGenericRules() {
      const range = (v) => {
        const [a, b] = String(v || '').split('-').map((n) => parseFloat(n));
        return [a, Number.isNaN(b) ? a : b];
      };
      return (this.dataset.genericRules || '')
        .split(/\r?\n/)
        .map((line) => line.split('|').map((p) => p.trim()))
        .filter((p) => p.length >= 3 && p[0] && p[1] && p[2])
        .map((p) => {
          const [hf, ht] = range(p[0]);
          const [wf, wt] = range(p[1]);
          return { hf, ht, wf, wt, s1: p[2], s2: p[3] || '', text: p.slice(4).join('|').trim() };
        })
        .filter((r) => [r.hf, r.ht, r.wf, r.wt].every((n) => !Number.isNaN(n)));
    }

    open() {
      this.update();
      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
    }

    /** Distance (cm + kg) from a value to a [from, to] range; 0 when inside. */
    static gap(v, from, to) {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      return v < lo ? lo - v : v > hi ? v - hi : 0;
    }

    update() {
      const h = Number(this.hIn.value);
      const w = Number(this.wIn.value);
      this.querySelector('[data-height-value]').textContent = h;
      this.querySelector('[data-weight-value]').textContent = w;
      this.querySelector('[data-height-output]').textContent = `${h} cm`;
      this.querySelector('[data-weight-output]').textContent = `${w} kg`;
      for (const input of [this.hIn, this.wIn]) {
        const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
        input.style.setProperty('--pct', `${pct}%`);
      }

      let best = null;
      let bestScore = Infinity;
      for (const r of this.rules) {
        const score = SizeGuide.gap(h, r.hf, r.ht) + SizeGuide.gap(w, r.wf, r.wt);
        if (score < bestScore) {
          best = r;
          bestScore = score;
        }
      }

      const sizeEl = this.querySelector('[data-result-size]');
      const textEl = this.querySelector('[data-result-text]');
      const tolerance = Number(this.dataset.tolerance) || 0;
      if (!best || bestScore > tolerance) {
        sizeEl.textContent = '—';
        textEl.textContent = this.dataset.fallback || '';
        return;
      }
      const orWord = this.dataset.or || 'or';
      sizeEl.textContent = best.s2 ? `${best.s1} ${orWord} ${best.s2}` : best.s1;
      textEl.textContent = best.text;
    }
  }
  customElements.define('size-guide', SizeGuide);
}
