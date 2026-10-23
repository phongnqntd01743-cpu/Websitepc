document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("cartContent");
  function render() {
    const cart = getCart();
    if (!cart.length) {
      root.innerHTML = '<div class="empty-cart"><div class="empty-icon">🛒</div><h2>Giỏ hàng đang trống</h2><p>Hãy thêm linh kiện để bắt đầu build PC.</p><a class="btn btn-primary" href="products.html">Khám phá linh kiện</a></div>';
      return;
    }
    const items = cart.map(i => ({ ...i, product: products.find(p => p.id === i.id) })).filter(i => i.product);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const shipping = subtotal >= 1000000 ? 0 : 30000;
    const total = subtotal + shipping;
    root.innerHTML = `<div class="cart-layout">
      <section class="cart-list">
        ${items.map(i => `
          <div class="cart-item">
            <div class="cart-item-img">
              ${i.product.image ? `<img src="${i.product.image}" alt="${i.product.name}">` : `<span class="cart-fallback-icon">${productIcon(i.product.category)}</span>`}
            </div>
            <div>
              <h3><a href="product-detail.html?id=${i.product.id}" style="color:inherit;text-decoration:none">${i.product.name}</a></h3>
              <small>${i.product.brand} · ${i.product.category}</small>
            </div>
            <div class="cart-price">${money(i.product.price)}</div>
            <div class="qty-control small">
              <button data-minus="${i.id}">−</button>
              <input value="${i.quantity}" readonly>
              <button data-plus="${i.id}">+</button>
            </div>
            <button class="remove-btn" data-remove="${i.id}" title="Xóa khỏi giỏ" aria-label="Xóa">×</button>
          </div>
        `).join("")}
        <button class="btn btn-secondary" id="clearCart" style="margin-top:15px">Xóa toàn bộ giỏ hàng</button>
      </section>
      <aside class="cart-summary">
        <h2>Tóm tắt đơn hàng</h2>
        <div class="summary-row"><span>Tạm tính</span><strong>${money(subtotal)}</strong></div>
        <div class="summary-row"><span>Vận chuyển</span><strong>${shipping ? money(shipping) : "Miễn phí"}</strong></div>
        <div class="summary-row total"><span>Tổng cộng</span><strong>${money(total)}</strong></div>
        <a class="btn btn-primary full" href="checkout.html">Tiến hành thanh toán →</a>
      </aside>
    </div>`;

    root.querySelectorAll("[data-plus]").forEach(b => b.onclick = () => change(Number(b.dataset.plus), 1));
    root.querySelectorAll("[data-minus]").forEach(b => b.onclick = () => change(Number(b.dataset.minus), -1));
    root.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => remove(Number(b.dataset.remove)));
    document.getElementById("clearCart").onclick = () => {
      saveCart([]);
      render();
      showToast("Đã xóa giỏ hàng.", "success");
    };
  }

  function change(id, d) {
    const cart = getCart(), i = cart.find(x => x.id === id);
    if (i) {
      const pr = products.find(p => p.id === id);
      i.quantity = Math.min(pr ? pr.stock : 99, Math.max(1, i.quantity + d));
    }
    saveCart(cart);
    render();
  }

  function remove(id) {
    saveCart(getCart().filter(x => x.id !== id));
    render();
    showToast("Đã xóa sản phẩm khỏi giỏ hàng.", "success");
  }

  render();
});