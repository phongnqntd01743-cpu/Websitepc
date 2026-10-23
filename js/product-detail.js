document.addEventListener("DOMContentLoaded", () => {
  const id = Number(new URLSearchParams(location.search).get("id"));
  const p = products.find(x => x.id === id);
  const root = document.getElementById("productDetail");

  if (!p) {
    root.innerHTML = '<div class="empty-cart"><h2>Không tìm thấy sản phẩm</h2><p>Vui lòng kiểm tra lại liên kết hoặc quay lại trang danh sách.</p><a class="btn btn-primary" href="products.html">Quay lại linh kiện</a></div>';
    return;
  }

  // Cập nhật tiêu đề trang
  document.title = `${p.name} - PCForge`;

  const imageHtml = p.image
    ? `<img src="${p.image}" alt="${p.name}" id="mainDetailImg">`
    : `<div class="product-placeholder">${productIcon(p.category)}</div>`;

  const reviews = p.reviews || 50;

  root.innerHTML = `
    <div class="product-detail">
      <div class="detail-image">
        ${imageHtml}
      </div>
      <div class="detail-info">
        <span class="section-kicker">${p.category}</span>
        <h1>${p.name}</h1>
        <div class="rating">
          <span class="stars">★★★★★</span>
          <span class="rating-val">${p.rating}</span>
          <span class="review-count">(${reviews} đánh giá)</span>
        </div>
        <div class="price">
          ${money(p.price)} ${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ""}
        </div>
        <p class="detail-description">${p.description}</p>
        <table class="spec-table">
          <tr><td>Thương hiệu</td><td><strong>${p.brand}</strong></td></tr>
          <tr><td>Tình trạng kho</td><td><span style="color: var(--green); font-weight: 600;">Còn hàng (${p.stock} sản phẩm)</span></td></tr>
          <tr><td>Socket</td><td>${p.socket || "—"}</td></tr>
          <tr><td>Hỗ trợ RAM</td><td>${p.ramType || "—"}</td></tr>
          <tr><td>Công suất tiêu thụ</td><td>${p.powerConsumption || 0}W</td></tr>
          ${p.recommendedPSU ? `<tr><td>Nguồn đề xuất</td><td>${p.recommendedPSU}W</td></tr>` : ""}
        </table>
        <div class="detail-buy-row">
          <div class="qty-control">
            <button id="minus" type="button" aria-label="Giảm số lượng">−</button>
            <input id="qty" value="1" readonly>
            <button id="plus" type="button" aria-label="Tăng số lượng">+</button>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" id="addDetail">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Thêm vào giỏ hàng
            </button>
            <a class="btn btn-secondary" href="builder.html">Dùng cho PC Builder →</a>
          </div>
        </div>
      </div>
    </div>
  `;

  let q = 1;
  const minusBtn = document.getElementById("minus");
  const plusBtn = document.getElementById("plus");
  const qtyInput = document.getElementById("qty");
  const addBtn = document.getElementById("addDetail");

  if (minusBtn && qtyInput) {
    minusBtn.onclick = () => {
      q = Math.max(1, q - 1);
      qtyInput.value = q;
    };
  }

  if (plusBtn && qtyInput) {
    plusBtn.onclick = () => {
      q = Math.min(p.stock, q + 1);
      qtyInput.value = q;
    };
  }

  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(p, q);
    };
  }

  renderProductsInto("relatedProducts", products.filter(x => x.category === p.category && x.id !== p.id).slice(0, 4));
});