/* =============================================
   CATALOG.JS — Catalog page logic
   ============================================= */

const GROUP_ICONS = {
  godynnyky: '⌚', sumky: '👜', valisy: '🧳',
  elektronika: '🎧', bezpeka: '📷', dim: '🏠', foto: '📸',
};

const CatalogPage = {
  catalog: null,
  allProducts: [],     // all loaded for current category
  filtered: [],        // after filters
  page: 1,
  perPage: CONFIG.itemsPerPage,
  onlyAvailable: true,
  selectedCatId: null,
  selectedGroupId: null,
  searchQuery: null,

  async init() {
    this.catalog = await DataLoader.catalog();
    const params = new URLSearchParams(window.location.search);
    this.selectedGroupId = params.get('group');
    this.selectedCatId   = params.get('cat') ? parseInt(params.get('cat')) : null;
    this.searchQuery     = params.get('search');

    this._renderSidebar();
    await this._loadProducts();
    this._updateAvailToggle();
    this._applyAndRender();
  },

  _renderSidebar() {
    const wrap = document.getElementById('sidebarCats');
    if (!wrap || !this.catalog) return;
    const html = this.catalog.groups.map(g => `
      <div class="cat-group">
        <div class="cat-group__title">${escHtml(g.name)}</div>
        ${g.cats.map(c => `
          <div class="cat-item${this.selectedCatId === c.id ? ' active' : ''}"
               onclick="CatalogPage.selectCat(${c.id}, '${escHtml(c.name)}', '${g.id}')">
            <span>${escHtml(c.name)}</span>
            <span class="count">${c.count}</span>
          </div>`).join('')}
      </div>`).join('');
    wrap.innerHTML = html;
  },

  async selectCat(catId, catName, groupId) {
    this.selectedCatId   = catId;
    this.selectedGroupId = groupId;
    this.searchQuery     = null;
    this.page = 1;
    history.replaceState(null, '', `catalog.html?cat=${catId}`);
    this._updateSidebarActive();
    await this._loadProducts();
    this._applyAndRender();
    // Update title & breadcrumb
    document.getElementById('pageTitle').textContent = catName;
    document.getElementById('breadcrumbCurrent').textContent = catName;
    // On mobile — close sidebar and scroll to products
    if (window.innerWidth <= 768) {
      document.getElementById('catalogSidebar')?.classList.remove('open');
      setTimeout(() => {
        document.getElementById('productsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  _updateSidebarActive() {
    document.querySelectorAll('.cat-item').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      el.classList.toggle('active', onclick.includes(`(${this.selectedCatId},`));
    });
  },

  async _loadProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = renderSkeletons(6);
    document.getElementById('countInfo').textContent = 'Завантаження...';
    this.allProducts = [];

    if (this.searchQuery) {
      this.allProducts = await DataLoader.search(this.searchQuery);
      document.getElementById('pageTitle').textContent = `Пошук: "${this.searchQuery}"`;
      document.getElementById('breadcrumbCurrent').textContent = `Пошук`;
      return;
    }

    if (this.selectedCatId) {
      this.allProducts = await DataLoader.category(this.selectedCatId);
      return;
    }

    if (this.selectedGroupId && this.catalog) {
      const group = this.catalog.groups.find(g => g.id === this.selectedGroupId);
      if (group) {
        document.getElementById('pageTitle').textContent = group.name;
        document.getElementById('breadcrumbCurrent').textContent = group.name;
        for (const cat of group.cats) {
          try {
            const prods = await DataLoader.category(cat.id);
            this.allProducts.push(...prods);
          } catch {}
        }
        return;
      }
    }

    // No filter — show featured (fast, already generated)
    this.allProducts = await DataLoader.featured();
    document.getElementById('pageTitle').textContent = 'Популярні товари';
    document.getElementById('breadcrumbCurrent').textContent = 'Каталог';
  },

  applyFilters() {
    this.page = 1;
    this._applyAndRender();
  },

  _applyAndRender() {
    let products = [...this.allProducts];

    // Availability
    if (this.onlyAvailable) {
      products = products.filter(p => p.available);
    }

    // Price filter
    const minP = parseFloat(document.getElementById('priceMin')?.value) || 0;
    const maxP = parseFloat(document.getElementById('priceMax')?.value) || Infinity;
    if (minP > 0 || maxP < Infinity) {
      products = products.filter(p => p.price >= minP && p.price <= maxP);
    }

    // Vendor filter
    const checkedVendors = [...document.querySelectorAll('#vendorList input:checked')].map(i => i.value);
    if (checkedVendors.length > 0) {
      products = products.filter(p => checkedVendors.includes(p.vendor));
    }

    // Sort
    const sort = document.getElementById('sortSelect')?.value || 'default';
    if (sort === 'price_asc')  products.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
    if (sort === 'name_asc')   products.sort((a, b) => a.name.localeCompare(b.name, 'uk'));

    this.filtered = products;
    this._renderVendors();
    this._renderProducts();
    this._renderPagination();
    document.getElementById('countInfo').innerHTML =
      `Знайдено: <strong>${products.length}</strong> товарів`;
  },

  _renderVendors() {
    const wrap = document.getElementById('vendorList');
    if (!wrap) return;
    const vendors = {};
    this.allProducts.forEach(p => {
      if (p.vendor) vendors[p.vendor] = (vendors[p.vendor] || 0) + 1;
    });
    const sorted = Object.entries(vendors).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const checkedVendors = new Set(
      [...document.querySelectorAll('#vendorList input:checked')].map(i => i.value)
    );
    wrap.innerHTML = sorted.map(([vendor, count]) => `
      <label class="vendor-check">
        <input type="checkbox" value="${escHtml(vendor)}" onchange="CatalogPage.applyFilters()"
          ${checkedVendors.has(vendor) ? 'checked' : ''}>
        <span>${escHtml(vendor)} <span style="color:var(--text-muted);font-size:.75rem">(${count})</span></span>
      </label>`).join('');
  },

  _renderProducts() {
    const grid = document.getElementById('productsGrid');
    const start = (this.page - 1) * this.perPage;
    const page  = this.filtered.slice(start, start + this.perPage);
    if (page.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">🔍</div>
          <h3>Нічого не знайдено</h3>
          <p>Спробуйте змінити фільтри або <a href="catalog.html" style="color:var(--accent)">переглянути всі товари</a></p>
        </div>`;
      return;
    }
    grid.innerHTML = page.map(renderProductCard).join('');
    this._translateCards();
  },

  async _translateCards() {
    const cards = [...document.querySelectorAll('.product-card__name')];
    if (cards.length === 0) return;
    try {
      const texts = cards.map(el => el.getAttribute('title') || el.textContent.trim());
      const { results, detectedLang } = await gtranslate(texts);
      if (detectedLang === 'uk') return;
      cards.forEach((el, i) => {
        if (results[i]) {
          el.textContent = results[i].slice(0, 80) + (results[i].length > 80 ? '...' : '');
          el.title = results[i];
        }
      });
    } catch {}
  },

  _renderPagination() {
    const wrap = document.getElementById('pagination');
    if (!wrap) return;
    const total = Math.ceil(this.filtered.length / this.perPage);
    if (total <= 1) { wrap.innerHTML = ''; return; }
    const range = [];
    for (let i = Math.max(1, this.page - 2); i <= Math.min(total, this.page + 2); i++) range.push(i);
    wrap.innerHTML = `
      <button class="page-btn" onclick="CatalogPage._goPage(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>‹</button>
      ${this.page > 3 ? `<button class="page-btn" onclick="CatalogPage._goPage(1)">1</button><span style="padding:0 4px;color:var(--text-muted)">…</span>` : ''}
      ${range.map(i => `<button class="page-btn${i === this.page ? ' active' : ''}" onclick="CatalogPage._goPage(${i})">${i}</button>`).join('')}
      ${this.page < total - 2 ? `<span style="padding:0 4px;color:var(--text-muted)">…</span><button class="page-btn" onclick="CatalogPage._goPage(${total})">${total}</button>` : ''}
      <button class="page-btn" onclick="CatalogPage._goPage(${this.page + 1})" ${this.page === total ? 'disabled' : ''}>›</button>`;
  },

  _goPage(n) {
    this.page = n;
    this._renderProducts();
    this._renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toggleAvailable() {
    this.onlyAvailable = !this.onlyAvailable;
    this._updateAvailToggle();
    this.applyFilters();
  },

  _updateAvailToggle() {
    document.getElementById('availToggle')?.classList.toggle('on', this.onlyAvailable);
  },

  resetFilters() {
    this.onlyAvailable = true;
    this._updateAvailToggle();
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.querySelectorAll('#vendorList input').forEach(i => i.checked = false);
    document.getElementById('sortSelect').value = 'default';
    this.applyFilters();
  },
};

function toggleSidebar() {
  const sidebar = document.getElementById('catalogSidebar');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  // Create/remove backdrop
  let backdrop = document.getElementById('sidebarBackdrop');
  if (isOpen) {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:996';
      backdrop.onclick = toggleSidebar;
      document.body.appendChild(backdrop);
    }
  } else {
    backdrop?.remove();
  }
}

document.addEventListener('DOMContentLoaded', () => CatalogPage.init());
