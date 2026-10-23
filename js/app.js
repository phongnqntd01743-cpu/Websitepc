const CART_KEY = "pcforge_cart";
const BUILD_KEY = "pcforge_build";
const THEME_KEY = "pcforge_theme";

// Áp dụng theme ngay lập tức để tránh nhấp nháy giao diện
(function () {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || (!saved && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

const money = n => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const el = document.getElementById("cartBadge");
  if (el) el.textContent = getCart().reduce((s, i) => s + i.quantity, 0);
}

function addToCart(product, quantity = 1) {
  const cart = getCart();
  const found = cart.find(i => i.id === product.id);
  if (found) found.quantity += quantity;
  else cart.push({ id: product.id, quantity });
  saveCart(cart);
  showToast("Đã thêm sản phẩm vào giỏ hàng!", "success");
}

function showToast(message, type = "success") {
  let box = document.getElementById("toast-container");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-container";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function productIcon(category) {
  const icon = categoryIcons[category];
  if (icon) return `<img src="${icon}" alt="${category}" class="cat-icon-img">`;
  return categorySymbols ? (categorySymbols[category] || "▣") : "▣";
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelectorAll(".theme-icon").forEach(el => el.textContent = "☀️");
    document.querySelectorAll(".theme-toggle-btn").forEach(el => {
      el.setAttribute("title", "Chuyển sang giao diện sáng (Light mode)");
      el.setAttribute("aria-label", "Chuyển sang giao diện sáng");
    });
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll(".theme-icon").forEach(el => el.textContent = "🌙");
    document.querySelectorAll(".theme-toggle-btn").forEach(el => {
      el.setAttribute("title", "Chuyển sang giao diện tối (Dark mode)");
      el.setAttribute("aria-label", "Chuyển sang giao diện tối");
    });
  }
}

function initThemeToggle() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "dark" : "light");

  // Đảm bảo nút đổi theme luôn hiện diện trong header-actions
  const headerActions = document.querySelector(".header-actions");
  if (headerActions && !document.getElementById("themeToggleBtn")) {
    const btn = document.createElement("button");
    btn.className = "theme-toggle-btn";
    btn.id = "themeToggleBtn";
    btn.setAttribute("aria-label", "Chuyển chế độ sáng/tối");
    btn.innerHTML = `<span class="theme-icon">${isDark ? "☀️" : "🌙"}</span>`;
    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  document.querySelectorAll(".theme-toggle-btn, #themeToggleBtn").forEach(btn => {
    btn.onclick = () => {
      const currentlyDark = document.documentElement.getAttribute("data-theme") === "dark";
      const nextTheme = currentlyDark ? "light" : "dark";
      localStorage.setItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      showToast(nextTheme === "dark" ? "Đã bật giao diện tối 🌙" : "Đã bật giao diện sáng ☀️", "success");
    };
  });
}

function productCard(p) {
  let badge = p.isNew ? '<span class="product-badge new">New</span>' : p.isHot ? '<span class="product-badge hot">Hot</span>' : p.isSale ? '<span class="product-badge sale">Sale</span>' : "";
  const image = p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : `<div class="product-placeholder">${productIcon(p.category)}</div>`;
  const reviews = p.reviews || 50;
  return `
    <article class="product-card">
      ${badge}
      <a href="product-detail.html?id=${p.id}" class="product-img-link">
        <div class="product-img">
          ${image}
          <div class="product-hover-info">
            <p>${p.description}</p>
            <small>Còn ${p.stock} sản phẩm</small>
          </div>
        </div>
      </a>
      <h3 title="${p.name}"><a href="product-detail.html?id=${p.id}">${p.name}</a></h3>
      <span class="product-brand">${p.brand}</span>
      <div class="price">
        ${money(p.price)} ${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ""}
      </div>
      <div class="rating">
        <span class="stars">★★★★★</span>
        <span class="rating-val">${p.rating}</span>
        <span class="review-count">(${reviews})</span>
      </div>
      <div class="product-actions">
        <a class="btn btn-outline" href="product-detail.html?id=${p.id}">Xem chi tiết</a>
        <button class="cart-icon-btn" data-add="${p.id}" aria-label="Thêm vào giỏ" title="Thêm vào giỏ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </button>
      </div>
    </article>
  `;
}

function bindProductButtons(root = document) {
  root.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => {
    const p = products.find(x => x.id == btn.dataset.add);
    if (p) addToCart(p);
  }));
}

function renderProductsInto(id, list) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = list.map(productCard).join("");
    bindProductButtons(el);
  }
}

function renderCategories() {
  const el = document.getElementById("categoryStrip");
  if (!el) return;
  el.innerHTML = categories.map(c => `
    <a class="category-item" href="products.html?category=${encodeURIComponent(c)}">
      <div class="category-icon">
        <img src="${categoryIcons[c]}" alt="${c}">
      </div>
      <strong>${c}</strong>
    </a>
  `).join("");
}

function renderMiniBuild() {
  const el = document.getElementById("miniBuildList");
  if (!el) return;
  let build = {};
  try {
    build = JSON.parse(localStorage.getItem(BUILD_KEY)) || {};
  } catch {}
  el.innerHTML = miniBuilderCategories.map(c => {
    const p = products.find(x => x.id === build[c]);
    return `
      <a class="mini-slot" href="builder.html" style="text-decoration:none;color:inherit" title="${p ? p.name : 'Chọn ' + c}">
        <div class="slot-icon">
          <img src="${categoryIcons[c]}" alt="${c}">
        </div>
        <div class="slot-info">
          <strong>${c}</strong>
          <small class="${p ? 'chosen' : ''}">${p ? p.name : "Chưa chọn"}</small>
        </div>
        <span class="slot-arrow">›</span>
      </a>
    `;
  }).join("");
  const total = Object.values(build).reduce((s, id) => s + (products.find(p => p.id === id)?.price || 0), 0);
  const totalEl = document.getElementById("miniBuildTotal");
  if (totalEl) totalEl.textContent = money(total);
}

function initMiniBuilderActions() {
  const saveBtn = document.getElementById("miniSaveBuild");
  const loadBtn = document.getElementById("miniLoadBuild");
  
  if (saveBtn) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      let build = {};
      try {
        build = JSON.parse(localStorage.getItem(BUILD_KEY)) || {};
      } catch {}
      if (Object.keys(build).length === 0) {
        showToast("Chưa có linh kiện nào được chọn để lưu!", "warning");
        return;
      }
      localStorage.setItem("pcforge_saved_build", JSON.stringify(build));
      showToast("Đã lưu cấu hình PC thành công! 💾", "success");
    });
  }
  
  if (loadBtn) {
    loadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        const saved = JSON.parse(localStorage.getItem("pcforge_saved_build"));
        if (!saved || Object.keys(saved).length === 0) {
          showToast("Chưa có cấu hình nào được lưu trước đó!", "warning");
          return;
        }
        localStorage.setItem(BUILD_KEY, JSON.stringify(saved));
        renderMiniBuild();
        showToast("Đã tải cấu hình PC đã lưu! 🚀", "success");
      } catch {
        showToast("Không tìm thấy cấu hình đã lưu!", "warning");
      }
    });
  }
}

function initHome() {
  renderCategories();
  const newItems = [1, 4, 7, 9].map(id => products.find(p => p.id === id)).filter(Boolean);
  renderProductsInto("newProducts", newItems.length === 4 ? newItems : products.filter(p => p.isNew).slice(0, 4));

  const hotItems = [3, 6, 19, 17].map(id => products.find(p => p.id === id)).filter(Boolean);
  renderProductsInto("hotProducts", hotItems.length === 4 ? hotItems : products.filter(p => p.isHot).slice(0, 4));

  renderProductsInto("saleProducts", products.filter(p => p.isSale).slice(0, 4));
  renderMiniBuild();
  initMiniBuilderActions();
  updateCartBadge();
  startCountdown();
}

function startCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  let end = localStorage.getItem("pcforge_sale_end");
  if (!end || Number(end) <= Date.now()) {
    end = Date.now() + 1000 * 60 * 60 * 15;
    localStorage.setItem("pcforge_sale_end", end);
  }
  function tick() {
    let diff = Math.max(0, Number(end) - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000) % 24;
    const m = Math.floor(diff / 60000) % 60;
    const s = Math.floor(diff / 1000) % 60;
    if (diff === 0) {
      el.innerHTML = "<strong>SALE ENDED</strong>";
      return;
    }
    el.innerHTML = `<span><b>${String(d).padStart(2, "0")}</b><small>Ngày</small></span><span><b>${String(h).padStart(2, "0")}</b><small>Giờ</small></span><span><b>${String(m).padStart(2, "0")}</b><small>Phút</small></span><span><b>${String(s).padStart(2, "0")}</b><small>Giây</small></span>`;
  }
  tick();
  setInterval(tick, 1000);
}

function initGlobalSearch() {
  const input = document.getElementById("globalSearch");
  const btn = document.getElementById("globalSearchBtn");
  if (!input) return;
  const go = () => {
    const q = input.value.trim();
    location.href = "products.html" + (q ? "?q=" + encodeURIComponent(q) : "");
  };
  btn?.addEventListener("click", go);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") go();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  updateCartBadge();
  initGlobalSearch();
  let menu = document.getElementById("mobileMenuBtn");
  let nav = document.getElementById("mainNav");
  if (!nav) {
    nav = document.querySelector(".main-nav");
    if (nav) nav.id = "mainNav";
  }
  if (!menu && nav) {
    menu = document.createElement("button");
    menu.className = "mobile-menu-btn";
    menu.id = "mobileMenuBtn";
    menu.textContent = "☰";
    menu.setAttribute("aria-label", "Mở menu");
    nav.parentNode.insertBefore(menu, nav);
  }
  menu?.addEventListener("click", () => nav?.classList.toggle("open"));
  if (document.getElementById("newProducts")) initHome();
});