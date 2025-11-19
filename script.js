/* Grab references to the UI so we can update it later */
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const productsContainer = document.getElementById("productsContainer");
const productsEmpty = document.getElementById("productsEmpty");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const rtlToggle = document.getElementById("rtlToggle");
const webSearchToggle = document.getElementById("webSearchToggle");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const chatStatus = document.getElementById("chatStatus");
const userInput = document.getElementById("userInput");

/* Use the value from secrets.js if present; otherwise fall back to an empty string */
const WORKER_URL = window.WORKER_URL ?? "";

/* Keys for persisting information between visits */
const STORAGE_KEY = "loreal-selected-products";

/* Hold product data, selections, and chat history in memory */
let allProducts = [];
let selectedProductIds = [];
let chatHistory = [
  {
    role: "system",
    content:
      "You are a friendly L'Oréal beauty advisor. Recommend routines using the selected products and keep the conversation focused on beauty care topics.",
  },
];
let routineGenerated = false;

/* Kick off the page once the DOM is ready */
document.addEventListener("DOMContentLoaded", () => {
  loadApp();
});

/* Load products, populate filters, and restore any saved selections */
async function loadApp() {
  try {
    allProducts = await loadProducts();
    populateCategoryFilter(allProducts);
    selectedProductIds = loadSelectionsFromStorage();
    renderSelectedProducts();
    renderProducts();
    addWelcomeMessage();
  } catch (error) {
    console.error("Unable to load products", error);
    productsContainer.innerHTML = "";
    productsEmpty.hidden = false;
    productsEmpty.textContent =
      "We could not load products right now. Please refresh to try again.";
  }
}

/* Fetch product data from the JSON file using async/await */
async function loadProducts() {
  const response = await fetch("products.json");

  if (!response.ok) {
    throw new Error("products.json failed to load");
  }

  const data = await response.json();
  return data.products;
}

/* Build the category dropdown based on the data so it always stays in sync */
function populateCategoryFilter(products) {
  const categories = new Set(products.map((product) => product.category));
  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));

  sortedCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = formatCategory(category);
    categoryFilter.appendChild(option);
  });
}

/* Format category strings so they look neat in the UI */
function formatCategory(category) {
  return category
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* Pull saved selections from localStorage if the user has been here before */
function loadSelectionsFromStorage() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not parse saved selections", error);
    return [];
  }
}

/* Keep localStorage updated whenever the selected list changes */
function saveSelectionsToStorage() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProductIds));
}

/* Re-render product cards whenever filters or selections change */
function renderProducts() {
  const filtered = filterProducts(allProducts);

  if (filtered.length === 0) {
    productsContainer.innerHTML = "";
    productsEmpty.hidden = false;
    return;
  }

  productsEmpty.hidden = true;

  const cardMarkup = filtered
    .map((product) =>
      createProductCard(product, selectedProductIds.includes(product.id))
    )
    .join("");

  productsContainer.innerHTML = cardMarkup;

  wireUpProductCards();
}

/* Filter the full list by the active category and search term */
function filterProducts(products) {
  const category = categoryFilter.value.trim().toLowerCase();
  const searchTerm = searchInput.value.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory = category ? product.category === category : true;
    const matchesSearch = searchTerm
      ? `${product.name} ${product.brand}`.toLowerCase().includes(searchTerm)
      : true;

    return matchesCategory && matchesSearch;
  });
}

/* Build the HTML for each product card */
function createProductCard(product, isSelected) {
  const descriptionId = `product-description-${product.id}`;

  return `
    <article class="product-card ${isSelected ? "selected" : ""}" data-id="${
    product.id
  }" role="listitem" tabindex="0" aria-pressed="${isSelected}">
      <img class="product-image" src="${product.image}" alt="${product.name}" />
      <div class="product-info">
        <span class="product-brand">${product.brand}</span>
        <h3>${product.name}</h3>
        <p class="product-category">${formatCategory(product.category)}</p>
        <button type="button" class="description-toggle" aria-expanded="false" aria-controls="${descriptionId}">View details</button>
      </div>
      <p id="${descriptionId}" class="product-description" hidden>${
    product.description
  }</p>
    </article>
  `;
}

/* Attach click handlers so cards can be selected and descriptions toggled */
function wireUpProductCards() {
  const cards = productsContainer.querySelectorAll(".product-card");

  cards.forEach((card) => {
    const productId = Number(card.dataset.id);
    const descriptionToggle = card.querySelector(".description-toggle");
    const description = card.querySelector(".product-description");

    card.addEventListener("click", () => {
      toggleProductSelection(productId);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleProductSelection(productId);
      }
    });

    if (descriptionToggle && description) {
      descriptionToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isExpanded =
          descriptionToggle.getAttribute("aria-expanded") === "true";
        descriptionToggle.setAttribute("aria-expanded", String(!isExpanded));
        descriptionToggle.textContent = isExpanded
          ? "View details"
          : "Hide details";
        description.hidden = isExpanded;
        description.classList.toggle("is-open", !isExpanded);
      });
    }
  });
}

/* Add or remove an item when a card is clicked */
function toggleProductSelection(productId) {
  if (selectedProductIds.includes(productId)) {
    selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  } else {
    selectedProductIds.push(productId);
  }

  saveSelectionsToStorage();
  renderSelectedProducts();
  renderProducts();
}

/* Render the selected list so users can review and remove items */
function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="placeholder-message">Tap any product card to add it to your routine shortlist.</p>
    `;
    return;
  }

  const markup = selectedProducts
    .map(
      (product) => `
      <article class="selected-chip" data-id="${product.id}">
        <div>
          <strong>${product.name}</strong>
          <span>${product.brand} • ${formatCategory(product.category)}</span>
        </div>
        <button type="button" class="remove-chip" aria-label="Remove ${
          product.name
        }">&times;</button>
      </article>
    `
    )
    .join("");

  selectedProductsList.innerHTML = markup;

  const removeButtons = selectedProductsList.querySelectorAll(".remove-chip");
  removeButtons.forEach((button) => {
    const productId = Number(button.parentElement.dataset.id);
    button.addEventListener("click", () => {
      removeSelectedProduct(productId);
    });
  });
}

/* Return product objects for the selected IDs */
function getSelectedProducts() {
  return allProducts.filter((product) =>
    selectedProductIds.includes(product.id)
  );
}

/* Remove an item directly from the selected list */
function removeSelectedProduct(productId) {
  selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  saveSelectionsToStorage();
  renderSelectedProducts();
  renderProducts();
}

/* Let users clear everything with one click */
clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelectionsToStorage();
  renderSelectedProducts();
  renderProducts();
});

/* Watch the filters so the grid updates in real time */
categoryFilter.addEventListener("change", () => {
  renderProducts();
});

searchInput.addEventListener("input", () => {
  renderProducts();
});

/* Toggle right-to-left layout support */
rtlToggle.addEventListener("click", () => {
  const isRtl = document.body.getAttribute("dir") === "rtl";
  document.body.setAttribute("dir", isRtl ? "ltr" : "rtl");
  rtlToggle.setAttribute("aria-pressed", String(!isRtl));
  rtlToggle.textContent = isRtl ? "Enable RTL Layout" : "Disable RTL Layout";
});

/* Show a friendly welcome message in the chat window */
function addWelcomeMessage() {
  addChatMessage(
    "ai",
    "Hello! Select a few L'Oréal favorites, then tap Generate Routine to see a personalized plan."
  );
}

/* Build a chat bubble and append it to the chat window */
function addChatMessage(role, content) {
  const messageWrapper = document.createElement("div");
  messageWrapper.className = `chat-message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = formatChatContent(content);

  const meta = document.createElement("span");
  meta.className = "chat-meta";
  meta.textContent = role === "user" ? "You" : "L'Oréal Advisor";

  messageWrapper.appendChild(meta);
  messageWrapper.appendChild(bubble);
  chatWindow.appendChild(messageWrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Simple formatter that converts new lines to <br> so they read nicely */
function formatChatContent(text) {
  const safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return safeText.replace(/\n/g, "<br>");
}

/* Send the selected products to the AI when the button is pressed */
generateRoutineBtn.addEventListener("click", async () => {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    chatStatus.textContent =
      "Select at least one product to build your routine.";
    return;
  }

  const systemMessage = chatHistory[0];
  chatHistory = [systemMessage];
  chatWindow.innerHTML = "";
  addWelcomeMessage();
  routineGenerated = false;

  chatStatus.textContent = "Generating your routine…";
  const selectionSummary = selectedProducts
    .map((product) => `• ${product.brand} ${product.name}`)
    .join("\n");
  const userVisibleMessage = `Here are the products I want to use:\n${selectionSummary}\nPlease create a beauty routine.`;
  addChatMessage("user", userVisibleMessage);

  const routinePrompt = buildRoutinePrompt(selectedProducts);
  chatHistory.push({ role: "user", content: routinePrompt });

  const response = await requestChatResponse();

  if (response.success) {
    routineGenerated = true;
    chatHistory.push({ role: "assistant", content: response.content });
    addChatMessage("ai", response.content);
    chatStatus.textContent = "Routine ready! Ask any follow-up questions.";
  } else {
    chatStatus.textContent = response.error;
  }
});

/* Compose a helpful, structured prompt for the AI */
function buildRoutinePrompt(selectedProducts) {
  const productLines = selectedProducts
    .map(
      (product) =>
        `- ${product.brand} ${product.name} (${formatCategory(
          product.category
        )}): ${product.description}`
    )
    .join("\n");

  return `Create a step-by-step beauty routine using only these L'Oréal group products. Include when to use each item, quick tips, and any warnings.\n${productLines}`;
}

/* Handle follow-up questions in the chat after a routine exists */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!routineGenerated) {
    chatStatus.textContent =
      "Generate a routine first so I know which products you're using.";
    return;
  }

  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  userInput.value = "";
  chatStatus.textContent = "Thinking…";
  addChatMessage("user", message);
  chatHistory.push({ role: "user", content: message });

  const response = await requestChatResponse();

  if (response.success) {
    chatHistory.push({ role: "assistant", content: response.content });
    addChatMessage("ai", response.content);
    chatStatus.textContent = "";
  } else {
    chatStatus.textContent = response.error;
  }
});

/* Send the full chat history to your Cloudflare Worker endpoint */
async function requestChatResponse() {
  if (!WORKER_URL) {
    return {
      success: false,
      error:
        "Add your Cloudflare Worker URL to secrets.js so the AI can respond.",
    };
  }

  try {
    const payload = {
      messages: chatHistory,
      webSearch: webSearchToggle.checked,
    };

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data?.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("No content returned from the AI");
    }

    return {
      success: true,
      content: aiContent.trim(),
    };
  } catch (error) {
    console.error("Chat request failed", error);
    return {
      success: false,
      error: "We hit a snag talking to the AI. Try again in a moment.",
    };
  }
}
