const quoteForm = document.querySelector("#quoteForm");
const formMessage = document.querySelector("#formMessage");
const leadModal = document.querySelector("#quote-modal");
const leadModalForm = document.querySelector("#leadModalForm");
const leadModalMessage = document.querySelector("#leadModalMessage");
const modalOpenButtons = document.querySelectorAll("[data-modal-open]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
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

const getPhoneDigits = (phone) => String(phone || "").replace(/\D/g, "");
const getSelectedProducts = (form) => {
  return Array.from(form.querySelectorAll("[name='products']:checked"))
    .map((input) => input.value.trim())
    .filter(Boolean)
    .join(", ");
};

const buildRequirementText = (...parts) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

const getFriendlyRequestError = (message) => {
  const text = String(message || "");
  const isMongoConnectionError = /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|server selection|MONGODB_URI|MONGO_URL/i.test(text);

  if (isMongoConnectionError) {
    return "Request could not be submitted right now. Please check the MongoDB connection and try again.";
  }

  return text || "Request could not be submitted";
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

const sendServiceRequest = async (url, payload) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

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
      throw new Error(getFriendlyRequestError(data.error || "Request could not be submitted"));
    }

    return data.request;
  } catch (error) {
    console.log(error);
    throw new Error(getFriendlyRequestError(error.message));
  }
};

const getServiceRequestUrls = () => {
  const urls = [API_URL];
  const isLocalPage =
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

  if (!isLocalPage) {
    return urls;
  }

  const localUrls = ["http://localhost:10000/api/requests", "http://127.0.0.1:10000/api/requests"];

  localUrls.forEach((url) => {
    if (!urls.includes(url) && window.location.origin !== new URL(url).origin) {
      urls.push(url);
    }
  });

  return urls;
};

const postServiceRequest = async (payload) => {
  let lastError;

  for (const url of getServiceRequestUrls()) {
    try {
      return await sendServiceRequest(url, payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Could not connect to the GharEx server. Please try again shortly.");
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

modalOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openLeadModal();
  });
});

modalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeLeadModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && leadModal?.classList.contains("is-open")) {
    closeLeadModal();
  }
});

leadModalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(leadModalForm);
  const name = formData.get("name")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim();
  const products = getSelectedProducts(leadModalForm);
  const message = formData.get("message")?.toString().trim();
  const requirement = buildRequirementText(products, message);

  try {
    const payload = validateRequestPayload({
      requestType: "quote",
      name,
      phone: formData.get("phone")?.toString().trim(),
      location,
      requirement,
      material: products,
      brickType: products,
      products,
      message
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
  const requirement = buildRequirementText(material);

  try {
    const payload = validateRequestPayload({
      requestType: "quote",
      name,
      phone: formData.get("phone")?.toString().trim(),
      quantity,
      requirement,
      material,
      location,
      brickType: material,
      products: material
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
