document.addEventListener("DOMContentLoaded", () => {
  const sections = document.getElementById("componentSections");
  const selectedEl = document.getElementById("selectedComponents");
  const quickSpecsEl = document.getElementById("pc3dQuickSpecs");
  const viewport = document.getElementById("pc3dViewport");

  let build = {};
  try {
    build = JSON.parse(localStorage.getItem(BUILD_KEY)) || {};
  } catch {}

  // Khởi tạo 3D PC Showcase Viewer
  let pc3d = null;
  if (viewport && window.PC3D && window.PC3D.supported) {
    pc3d = PC3D.create(viewport, {
      getProduct: (id) => products.find(p => p.id === id),
      onPick: (cat) => {
        const grp = document.getElementById(`group-${cat}`);
        if (grp) {
          grp.scrollIntoView({ behavior: "smooth", block: "center" });
          grp.classList.remove("highlight-flash");
          void grp.offsetWidth;
          grp.classList.add("highlight-flash");
          showToast(`Đã chọn linh kiện: ${cat} từ mô hình 3D`, "info");
        }
      }
    });
  }

  function getSpecsBadge(p) {
    const badges = [];
    if (p.socket) badges.push(`<span class="spec-tag">${p.socket}</span>`);
    if (p.ramType) badges.push(`<span class="spec-tag">${p.ramType}</span>`);
    if (p.formFactor) badges.push(`<span class="spec-tag">${p.formFactor}</span>`);
    if (p.powerConsumption && p.powerConsumption > 0) badges.push(`<span class="spec-tag">${p.powerConsumption}W</span>`);
    if (p.wattage) badges.push(`<span class="spec-tag">${p.wattage}W</span>`);
    if (p.gpuLength) badges.push(`<span class="spec-tag">Dài ${p.gpuLength}mm</span>`);
    if (p.gpuSupport) badges.push(`<span class="spec-tag">GPU ≤${p.gpuSupport}mm</span>`);
    if (p.storageType) badges.push(`<span class="spec-tag">${p.storageType}</span>`);
    return badges.join("");
  }

  function renderPicker() {
    sections.innerHTML = builderCategories.map(cat => {
      const list = products.filter(p => p.category === cat);
      const isCatChosen = !!build[cat];
      const chosenProduct = isCatChosen ? products.find(x => x.id === build[cat]) : null;

      return `
        <div class="component-group" id="group-${cat}">
          <div class="component-group-head">
            <div>
              <strong style="display:inline-flex;align-items:center;gap:8px">
                <img src="${categoryIcons[cat]}" alt="${cat}" style="width:22px;height:22px;object-fit:contain">
                ${cat}
              </strong>
              <small class="comp-count">(${list.length} linh kiện)</small>
            </div>
            <span class="group-status ${isCatChosen ? "chosen" : ""}">${isCatChosen ? `✓ Đã chọn: ${chosenProduct ? chosenProduct.name : ""}` : "Chưa chọn"}</span>
          </div>
          <div class="component-options">
            ${list.map(p => {
              const isSelected = build[cat] === p.id;
              return `
                <div class="component-option ${isSelected ? "selected" : ""}" data-component="${cat}" data-id="${p.id}">
                  <div class="option-thumb">
                    <img src="${p.image}" alt="${p.name}" loading="lazy">
                    ${isSelected ? '<span class="selected-badge">✓ Đã chọn</span>' : ''}
                  </div>
                  <div class="option-details">
                    <span class="option-brand">${p.brand}</span>
                    <strong class="option-name" title="${p.name}">${p.name}</strong>
                    <div class="option-specs">${getSpecsBadge(p)}</div>
                    <div class="option-bottom">
                      <span class="option-price">${money(p.price)}</span>
                      <button class="btn-select-comp" type="button">${isSelected ? "Bỏ chọn" : "Chọn"}</button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");

    sections.querySelectorAll(".component-option").forEach(el => {
      el.addEventListener("click", () => {
        const cat = el.dataset.component;
        const id = Number(el.dataset.id);
        if (build[cat] === id) {
          delete build[cat];
        } else {
          build[cat] = id;
        }
        renderAll();
      });

      // Hiệu ứng rê chuột: highlight linh kiện tương ứng trên thùng máy 3D
      el.addEventListener("mouseenter", () => {
        if (pc3d) pc3d.highlight(el.dataset.component);
      });
      el.addEventListener("mouseleave", () => {
        if (pc3d) pc3d.highlight(null);
      });
    });
  }

  function renderSelected() {
    selectedEl.innerHTML = builderCategories.map(cat => {
      const p = products.find(x => x.id === build[cat]);
      if (!p) {
        return `
          <div class="selected-item empty" data-cat="${cat}">
            <div class="sel-icon"><img src="${categoryIcons[cat]}" alt="${cat}" style="width:20px;height:20px;object-fit:contain"></div>
            <div class="sel-text">
              <strong>${cat}</strong>
              <small>Chưa chọn linh kiện</small>
            </div>
            <a class="sel-pick-link" href="#group-${cat}">+ Chọn</a>
          </div>
        `;
      }
      return `
        <div class="selected-item active" data-cat="${cat}">
          <div class="sel-thumb">
            <img src="${p.image}" alt="${p.name}">
          </div>
          <div class="sel-text">
            <span class="sel-cat-tag">${cat}</span>
            <strong class="sel-prod-name" title="${p.name}">${p.name}</strong>
            <small class="sel-price">${money(p.price)}</small>
          </div>
          <button class="remove-component" data-remove="${cat}" title="Bỏ chọn ${cat}" aria-label="Xóa ${cat}">×</button>
        </div>
      `;
    }).join("");

    selectedEl.querySelectorAll(".selected-item").forEach(item => {
      item.addEventListener("mouseenter", () => {
        if (pc3d) pc3d.highlight(item.dataset.cat);
      });
      item.addEventListener("mouseleave", () => {
        if (pc3d) pc3d.highlight(null);
      });
    });

    selectedEl.querySelectorAll("[data-remove]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        delete build[b.dataset.remove];
        renderAll();
      });
    });
  }

  function total() {
    return Object.values(build).reduce((s, id) => s + (products.find(p => p.id === id)?.price || 0), 0);
  }

  function power() {
    return Object.values(build).reduce((s, id) => s + (products.find(p => p.id === id)?.powerConsumption || 0), 0);
  }

  function check() {
    const messages = [];
    const issueCats = new Set();
    let ok = true;

    const cpu = products.find(p => p.id === build.CPU);
    const mb = products.find(p => p.id === build.Mainboard);
    const ram = products.find(p => p.id === build.RAM);
    const gpu = products.find(p => p.id === build.GPU);
    const psu = products.find(p => p.id === build.PSU);
    const cooler = products.find(p => p.id === build.Cooler);
    const casing = products.find(p => p.id === build.Case);

    if (cpu && mb) {
      if (cpu.socket !== mb.socket) {
        ok = false;
        issueCats.add("CPU");
        issueCats.add("Mainboard");
        messages.push(`CPU (${cpu.socket}) không tương thích Mainboard (${mb.socket}).`);
      } else {
        messages.push(`✓ CPU và Mainboard cùng socket ${cpu.socket}.`);
      }
    }
    if (ram && mb) {
      if (ram.ramType !== mb.ramType) {
        ok = false;
        issueCats.add("RAM");
        issueCats.add("Mainboard");
        messages.push(`RAM (${ram.ramType}) không phù hợp với Mainboard (${mb.ramType}).`);
      } else {
        messages.push(`✓ RAM và Mainboard cùng chuẩn ${ram.ramType}.`);
      }
    }
    if (gpu && casing && gpu.gpuLength && casing.gpuSupport && gpu.gpuLength > casing.gpuSupport) {
      ok = false;
      issueCats.add("GPU");
      issueCats.add("Case");
      messages.push(`⚠ GPU dài (${gpu.gpuLength}mm) vượt quá giới hạn Case (${casing.gpuSupport}mm).`);
    } else if (gpu && casing) {
      messages.push(`✓ Kích thước GPU (${gpu.gpuLength}mm) vừa vặn với Case (hỗ trợ ≤${casing.gpuSupport}mm).`);
    }
    if (psu) {
      const need = power() + 80;
      if (psu.wattage < need) {
        ok = false;
        issueCats.add("PSU");
        messages.push(`⚠ Nguồn ${psu.wattage}W thấp hơn mức khuyến nghị (${need}W).`);
      } else {
        messages.push(`✓ Nguồn ${psu.wattage}W đáp ứng tốt công suất hệ thống (${power()}W).`);
      }
    }
    if (cooler) {
      messages.push(`✓ Tản nhiệt CPU (${cooler.name}) đã được chọn.`);
    }

    if (!messages.length) {
      messages.push("Hãy chọn thêm linh kiện để kiểm tra tương thích.");
    }
    return { ok, messages, issueCats: Array.from(issueCats) };
  }

  function renderQuickSpecs() {
    if (!quickSpecsEl) return;
    const cpu = products.find(p => p.id === build.CPU);
    const gpu = products.find(p => p.id === build.GPU);
    const mb = products.find(p => p.id === build.Mainboard);
    const casing = products.find(p => p.id === build.Case);
    const psu = products.find(p => p.id === build.PSU);

    const pills = [];

    if (casing) {
      pills.push(`
        <div class="pc3d-spec-pill" title="Vỏ Case">
          <img src="${categoryIcons.Case}" alt="Case">
          <span>Case: <strong>${casing.name}</strong></span>
        </div>
      `);
    }
    if (mb) {
      pills.push(`
        <div class="pc3d-spec-pill" title="Mainboard">
          <img src="${categoryIcons.Mainboard}" alt="Mainboard">
          <span>Main: <strong>${mb.socket} / ${mb.ramType}</strong></span>
        </div>
      `);
    }
    if (cpu) {
      pills.push(`
        <div class="pc3d-spec-pill" title="CPU">
          <img src="${categoryIcons.CPU}" alt="CPU">
          <span>CPU: <strong>${cpu.name.replace(/^(AMD|Intel)\s*/i, "")}</strong></span>
        </div>
      `);
    }
    if (gpu) {
      pills.push(`
        <div class="pc3d-spec-pill" title="GPU">
          <img src="${categoryIcons.GPU}" alt="GPU">
          <span>GPU: <strong>${gpu.name.replace(/^(NVIDIA|MSI|ASUS)\s*/i, "")}</strong></span>
        </div>
      `);
    }
    if (psu) {
      pills.push(`
        <div class="pc3d-spec-pill accent" title="Công suất nguồn">
          <img src="${categoryIcons.PSU}" alt="PSU">
          <span>Nguồn: <strong>${power()}W / ${psu.wattage}W</strong></span>
        </div>
      `);
    } else if (power() > 0) {
      pills.push(`
        <div class="pc3d-spec-pill accent" title="Công suất ước tính">
          <img src="${categoryIcons.PSU}" alt="PSU">
          <span>Tiêu thụ: <strong>${power()}W</strong></span>
        </div>
      `);
    }

    quickSpecsEl.innerHTML = pills.join("");
  }

  function renderSummary() {
    document.getElementById("buildTotal").textContent = money(total());
    document.getElementById("estimatedPower").textContent = power() + "W";
    document.getElementById("componentCount").textContent = Object.keys(build).length;
    const r = check();
    const box = document.getElementById("compatibilityBox");
    const dot = document.getElementById("buildStatusDot");
    box.className = "compatibility-box " + (Object.keys(build).length === 0 ? "neutral" : r.ok ? "ok" : "warn");
    box.innerHTML = r.messages.length ? `<ul>${r.messages.map(x => `<li>${x}</li>`).join("")}</ul>` : "";
    dot.className = "status-dot " + (Object.keys(build).length === 0 ? "" : r.ok ? "ok" : "warn");

    // Cập nhật 3D View với build mới và danh sách cảnh báo
    if (pc3d) {
      pc3d.update(build, r.issueCats);
    }
    renderQuickSpecs();
  }

  function renderAll() {
    localStorage.setItem(BUILD_KEY, JSON.stringify(build));
    renderPicker();
    renderSelected();
    renderSummary();
  }

  document.getElementById("saveBuild").onclick = () => {
    localStorage.setItem(BUILD_KEY, JSON.stringify(build));
    showToast("Đã lưu cấu hình PC thành công!", "success");
  };

  document.getElementById("loadBuild").onclick = () => {
    try {
      build = JSON.parse(localStorage.getItem(BUILD_KEY)) || {};
      renderAll();
      showToast("Đã tải lại cấu hình đã lưu!", "success");
    } catch {
      showToast("Không tìm thấy cấu hình đã lưu.", "error");
    }
  };

  document.getElementById("checkCompatibility").onclick = () => {
    const r = check();
    showToast(r.ok ? "Cấu hình tương thích hoàn hảo!" : "Cấu hình có cảnh báo tương thích.", r.ok ? "success" : "error");
    renderSummary();
  };

  document.getElementById("addBuildToCart").onclick = () => {
    const ids = Object.values(build);
    if (!ids.length) {
      showToast("Hãy chọn ít nhất một linh kiện để thêm vào giỏ.", "error");
      return;
    }
    const cart = getCart();
    ids.forEach(id => {
      const found = cart.find(i => i.id === id);
      if (found) found.quantity++;
      else cart.push({ id, quantity: 1 });
    });
    saveCart(cart);
    showToast(`Đã thêm ${ids.length} linh kiện cấu hình vào giỏ hàng!`, "success");
  };

  renderAll();
});