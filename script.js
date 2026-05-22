const quoteForm = document.querySelector("#quoteForm");
const formMessage = document.querySelector("#formMessage");
const leadModal = document.querySelector("#quote-modal");
const leadModalForm = document.querySelector("#leadModalForm");
const leadModalMessage = document.querySelector("#leadModalMessage");
const modalOpenButtons = document.querySelectorAll("[data-modal-open]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
const priceCompareModal = document.querySelector("#price-compare-modal");
const priceCompareOpenButtons = document.querySelectorAll("[data-price-compare-open]");
const priceCompareCloseButtons = document.querySelectorAll("[data-price-compare-close]");
const priceCompareForm = document.querySelector("#priceComparePhoneForm");
const priceCompareMessage = document.querySelector("#priceCompareMessage");
const priceSort = document.querySelector("#priceSort");
const brickGradeFilter = document.querySelector("#brickGradeFilter");
const topRatedFilter = document.querySelector("#topRatedFilter");
const manufacturerPriceList = document.querySelector("#manufacturerPriceList");
const registrationForm = document.querySelector("#registrationForm");
const registrationType = document.querySelector("#registrationType");
const registrationTitle = document.querySelector("#registrationTitle");
const registrationText = document.querySelector("#registrationText");
const registrationMessage = document.querySelector("#registrationMessage");
const thankYouName = document.querySelector("#thankYouName");
const thankYouMessage = document.querySelector("#thankYouMessage");
const sellerRequiredFields = document.querySelectorAll("[data-seller-required]");
const buyerRequiredFields = document.querySelectorAll("[data-buyer-required]");
const registrationNameInput = registrationForm?.querySelector("[name='name']");
const registrationPhoneInput = registrationForm?.querySelector("[name='phone']");
const registrationLocationInput = registrationForm?.querySelector("[name='location']");
const registrationButton = registrationForm?.querySelector("button[type='submit']");
const API_URL = "/api/requests";
let verifiedPriceComparePhone = "";
let verifiedPriceCompareName = "";
const manufacturerPrices = [
  { name: "Guddu Singh Bricks", location: "Mohali", brickType: "Red Clay Bricks", grade: "1", price: 8400, rating: 4.8, unit: "per 1000 bricks" },
  { name: "Chandigarh Brick Works", location: "Chandigarh", brickType: "Red Clay Bricks", grade: "2", price: 7600, rating: 4.5, unit: "per 1000 bricks" },
  { name: "Punjab Construction Bricks", location: "Kharar", brickType: "Machine Made Bricks", grade: "1", price: 8900, rating: 4.9, unit: "per 1000 bricks" },
  { name: "Tricity Brick Suppliers", location: "Zirakpur", brickType: "Wire Cut Bricks", grade: "1", price: 9200, rating: 4.7, unit: "per 1000 bricks" },
  { name: "Mohali Red Brick Depot", location: "Mohali", brickType: "Red Clay Bricks", grade: "3", price: 6800, rating: 4.2, unit: "per 1000 bricks" },
  { name: "North India Brick House", location: "Panchkula", brickType: "Machine Made Bricks", grade: "2", price: 7950, rating: 4.6, unit: "per 1000 bricks" }
];

const getPhoneDigits = (phone) => String(phone || "").replace(/\D/g, "");
const getSelectedProducts = (form) => {
  return Array.from(form.querySelectorAll("[name='products']:checked"))
    .map((input) => input.value.trim())
    .filter(Boolean)
    .join(", ");
};

const setupProductChecks = (form) => {
  if (!form) return;

  const allProducts = form.querySelector("[data-product-all]");
  const productOptions = Array.from(form.querySelectorAll("[data-product-option]"));

  allProducts?.addEventListener("change", () => {
    productOptions.forEach((option) => {
      option.checked = allProducts.checked;
    });
  });

  productOptions.forEach((option) => {
    option.addEventListener("change", () => {
      if (!allProducts) return;
      allProducts.checked = productOptions.every((productOption) => productOption.checked);
    });
  });
};

const validateRequestPayload = (payload, options = {}) => {
  const name = payload.name?.trim();
  const phoneDigits = getPhoneDigits(payload.phone);
  const quantityValue = String(payload.quantity ?? "").trim();

  if (!name) {
    throw new Error("Name is required");
  }

  if (!/^\d{10}$/.test(phoneDigits)) {
    throw new Error("Phone number must be exactly 10 digits");
  }

  if (options.requireQuantity || quantityValue) {
    const quantity = Number(quantityValue);

    if (!Number.isFinite(quantity) || quantity < 3000) {
      throw new Error("Quantity must be at least 3000");
    }
  }

  return {
    ...payload,
    name,
    phone: phoneDigits,
    quantity: quantityValue || payload.quantity
  };
};

const postServiceRequest = async (payload) => {
  let response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.log(error);
    throw new Error("Could not connect to the GharEx server. Please try again shortly.");
  }

  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.log(error);
      throw new Error("The request API did not return a valid response. Please try again shortly.");
    }
  }

  if (!response.ok) {
    console.log(data.error || "Request could not be submitted");
    throw new Error(data.error || "Request could not be submitted");
  }

  return data.request;
};

const openLeadModal = () => {
  if (!leadModal) return;
  leadModal.classList.add("is-open");
  leadModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.setTimeout(() => {
    leadModalForm?.querySelector("input")?.focus();
  }, 120);
};

const closeLeadModal = () => {
  if (!leadModal) return;
  leadModal.classList.remove("is-open");
  leadModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const setPriceCompareStep = (stepName) => {
  priceCompareForm?.querySelectorAll("[data-verify-step]").forEach((step) => {
    step.classList.toggle("is-active", step.dataset.verifyStep === stepName);
  });
};

const openPriceCompareModal = () => {
  if (!priceCompareModal) return;
  priceCompareModal.classList.add("is-open");
  priceCompareModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  priceCompareForm?.reset();
  verifiedPriceComparePhone = "";
  verifiedPriceCompareName = "";
  setPriceCompareStep("phone");
  if (priceSort) priceSort.value = "low-high";
  if (brickGradeFilter) brickGradeFilter.value = "all";
  if (topRatedFilter) topRatedFilter.checked = false;
  renderManufacturerPrices();
  if (priceCompareMessage) priceCompareMessage.textContent = "";
  window.setTimeout(() => {
    priceCompareForm?.querySelector("[name='name']")?.focus();
  }, 120);
};

const closePriceCompareModal = () => {
  if (!priceCompareModal) return;
  priceCompareModal.classList.remove("is-open");
  priceCompareModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(price);

const renderManufacturerPrices = () => {
  if (!manufacturerPriceList) return;

  const sortOrder = priceSort?.value || "low-high";
  const selectedGrade = brickGradeFilter?.value || "all";
  const showTopRated = Boolean(topRatedFilter?.checked);

  const prices = manufacturerPrices
    .filter((item) => selectedGrade === "all" || item.grade === selectedGrade)
    .filter((item) => !showTopRated || item.rating >= 4.7)
    .sort((a, b) => {
      return sortOrder === "high-low" ? b.price - a.price : a.price - b.price;
    });

  if (!prices.length) {
    manufacturerPriceList.innerHTML = '<p class="compare-empty">No manufacturer prices found for this selection.</p>';
    return;
  }

  manufacturerPriceList.innerHTML = prices
    .map(
      (item) => `
        <article class="manufacturer-card">
          <div>
            <h4>${item.name}</h4>
            <p>${item.location} &middot; ${item.brickType} &middot; ${item.rating}/5 rated</p>
          </div>
          <div class="manufacturer-price">
            <strong>${formatPrice(item.price)}</strong>
            <span>${item.unit}</span>
          </div>
          <span class="grade-badge">No. ${item.grade} Grade</span>
          <button class="manufacturer-buy" type="button" data-manufacturer="${item.name}">Buy</button>
        </article>
      `
    )
    .join("");

  manufacturerPriceList.querySelectorAll("[data-manufacturer]").forEach((button) => {
    button.addEventListener("click", () => {
      closePriceCompareModal();
      openLeadModal();
      const messageBox = leadModalForm?.querySelector("[name='message']");
      if (messageBox) {
        messageBox.value = `I want to buy bricks from ${button.dataset.manufacturer}.`;
      }
    });
  });
};

modalOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openLeadModal();
  });
});

modalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeLeadModal);
});

priceCompareOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openPriceCompareModal();
  });
});

priceCompareCloseButtons.forEach((button) => {
  button.addEventListener("click", closePriceCompareModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && leadModal?.classList.contains("is-open")) {
    closeLeadModal();
  }

  if (event.key === "Escape" && priceCompareModal?.classList.contains("is-open")) {
    closePriceCompareModal();
  }
});

priceCompareForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(priceCompareForm);
  const name = formData.get("name")?.toString().trim() || "";
  const phoneDigits = getPhoneDigits(formData.get("phone"));

  if (!name) {
    priceCompareMessage.textContent = "Name is required.";
    return;
  }

  if (!/^\d{10}$/.test(phoneDigits)) {
    priceCompareMessage.textContent = "Enter a valid 10 digit mobile number.";
    return;
  }

  verifiedPriceCompareName = name;
  verifiedPriceComparePhone = phoneDigits;
  priceCompareMessage.textContent = "";
  renderManufacturerPrices();
  setPriceCompareStep("compare");
});

[priceSort, brickGradeFilter, topRatedFilter].forEach((control) => {
  control?.addEventListener("change", renderManufacturerPrices);
});

leadModalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(leadModalForm);
  const name = formData.get("name")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim();
  const products = getSelectedProducts(leadModalForm);

  try {
    const payload = validateRequestPayload({
      requestType: "quote",
      name,
      phone: formData.get("phone")?.toString().trim(),
      location,
      material: products,
      brickType: products,
      products,
      message: formData.get("message")?.toString().trim()
    });

    await postServiceRequest(payload);
    alert("Request submitted successfully");
    leadModalMessage.textContent = `Thanks, ${name}. The GharEx team will contact you shortly${location ? ` for your requirement in ${location}` : ""}.`;
    leadModalForm.reset();
  } catch (error) {
    console.log(error);
    leadModalMessage.textContent = error.message;
  }
});

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(quoteForm);
  const name = formData.get("name")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim();
  const material = getSelectedProducts(quoteForm) || formData.get("material")?.toString().trim() || formData.get("brickType")?.toString().trim();
  const quantity = formData.get("quantity")?.toString().trim();

  try {
    const payload = validateRequestPayload({
      requestType: "quote",
      name,
      phone: formData.get("phone")?.toString().trim(),
      quantity,
      material,
      location,
      brickType: material
    });

    await postServiceRequest(payload);
    alert("Request submitted successfully");
    formMessage.textContent = `Thanks, ${name}. The GharEx team will contact you shortly${location ? ` for your requirement in ${location}` : ""}.`;
    quoteForm.reset();
  } catch (error) {
    console.log(error);
    formMessage.textContent = error.message;
  }
});

setupProductChecks(quoteForm);
setupProductChecks(leadModalForm);

const updateRegistrationCopy = (type) => {
  if (!registrationTitle || !registrationText) return;
  const isSeller = type === "sell";

  document.body.classList.toggle("seller-mode", isSeller);
  document.body.classList.toggle("buyer-mode", !isSeller);
  registrationForm?.classList.toggle("seller-form", isSeller);
  sellerRequiredFields.forEach((field) => {
    field.required = isSeller;
  });
  buyerRequiredFields.forEach((field) => {
    field.required = !isSeller;
  });

  if (isSeller) {
    registrationTitle.textContent = "Sell with us.";
    registrationText.textContent = "Share your manufacturer details and the products you supply. GharEx will contact you for partnership next steps.";
    if (registrationNameInput) registrationNameInput.placeholder = "Name";
    if (registrationPhoneInput) registrationPhoneInput.placeholder = "Phone Number";
    if (registrationLocationInput) registrationLocationInput.placeholder = "City";
    if (registrationButton) registrationButton.textContent = "Submit";
    return;
  }

  registrationTitle.textContent = "Buy from GharEx.";
  registrationText.textContent = "Register your construction material requirement and the GharEx team will coordinate the next step.";
  if (registrationNameInput) registrationNameInput.placeholder = "Your name";
  if (registrationPhoneInput) registrationPhoneInput.placeholder = "Your phone";
  if (registrationLocationInput) registrationLocationInput.placeholder = "Your city or business location";
  if (registrationButton) registrationButton.textContent = "Send Requirement";
};

if (registrationType) {
  const params = new URLSearchParams(window.location.search);
  const selectedType = params.get("type") === "sell" ? "sell" : "buy";

  registrationType.value = selectedType;
  updateRegistrationCopy(selectedType);
  registrationType.addEventListener("change", () => updateRegistrationCopy(registrationType.value));
}

registrationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const type = formData.get("type") === "sell" ? "sell" : "buy";
  const name = formData.get("name")?.toString().trim() || "";

  try {
    const quantity = formData.get("quantity")?.toString().trim();
    const payload = validateRequestPayload(
      {
        requestType: type,
        name,
        phone: formData.get("phone")?.toString().trim(),
        email: formData.get("email")?.toString().trim(),
        location: formData.get("location")?.toString().trim(),
        material: formData.get("material")?.toString().trim(),
        quantity,
        deliveryLocation: formData.get("deliveryLocation")?.toString().trim(),
        products: formData.get("products")?.toString().trim(),
        message: formData.get("message")?.toString().trim()
      },
      { requireQuantity: type === "buy" }
    );

    await postServiceRequest(payload);
    alert("Request submitted successfully");
    registrationMessage.textContent = `Thanks, ${name || "there"}. Your request has been submitted successfully.`;
    registrationForm.reset();
    registrationType.value = type;
    updateRegistrationCopy(type);
  } catch (error) {
    console.log(error);
    registrationMessage.textContent = error.message;
  }
});

if (thankYouName && thankYouMessage) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name")?.trim();
  const type = params.get("type") === "sell" ? "sell" : "buy";

  thankYouName.textContent = name ? `, ${name}` : "";
  thankYouMessage.textContent =
    type === "sell"
      ? "Your manufacturer registration has been received by GharEx. Our team will review your details and contact you shortly to discuss partnership opportunities."
      : "Your buying requirement has been received by GharEx. Our team will review your details and contact you shortly with the next step.";
}
