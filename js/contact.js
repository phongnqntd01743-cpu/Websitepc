// Validate form liên hệ: kiểm tra rỗng + định dạng email
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const rules = [
    ["contactName", "Họ tên", v => v.trim().length >= 2],
    ["contactEmail", "Email", v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())],
    ["contactMessage", "Nội dung", v => v.trim().length >= 10]
  ];
  form.addEventListener("submit", e => {
    e.preventDefault();
    let valid = true;
    rules.forEach(([id, label, rule]) => {
      const input = document.getElementById(id);
      const err = input.parentElement.querySelector(".error");
      if (!input.value.trim()) { valid = false; err.textContent = `${label} không được để trống.`; }
      else if (!rule(input.value)) { valid = false; err.textContent = `${label} không hợp lệ.`; }
      else err.textContent = "";
    });
    if (!valid) return;
    const list = JSON.parse(localStorage.getItem("pcforge_contacts") || "[]");
    list.unshift({ name: contactName.value, email: contactEmail.value, message: contactMessage.value, date: new Date().toISOString() });
    localStorage.setItem("pcforge_contacts", JSON.stringify(list));
    showToast("Đã gửi liên hệ thành công!", "success");
    form.reset();
  });
});
