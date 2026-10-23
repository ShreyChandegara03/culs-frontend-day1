// The Little Herb Garden: fetch herb data, render cards, search by name, and show detail pages.
const herbSlugs = ["basil", "spearmint", "rosemary", "thyme", "lavender", "sage", "chamomile", "chives"];
const herbList = document.querySelector("#herb-list");
const status = document.querySelector("#status");
const detailSection = document.querySelector("#herb-detail");
const detailContent = document.querySelector("#detail-content");
const searchForm = document.querySelector("#herb-search");
const searchInput = document.querySelector("#herb-name");
const suggestionBox = document.querySelector("#herb-suggestions");
let cachedHerbs = [];

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fetchHerb(slug) {
  const response = await fetch(`data/${encodeURIComponent(slug)}.json`);
  if (!response.ok) {
    throw new Error(response.status === 404
      ? `No herb data file was found for "${slug}".`
      : `The herb data could not be loaded (HTTP ${response.status}).`);
  }
  const herb = await response.json();
  if (!herb.slug || !herb.name || !herb.latin || !herb.description || !herb.image) {
    throw new Error(`The data file for "${slug}" is missing required fields.`);
  }
  return herb;
}

function makeHerbCard(herb) {
  const link = makeElement("a", "herb-card");
  link.href = `#${herb.slug}`;
  link.setAttribute("aria-label", `View ${herb.name} details`);

  const image = makeElement("img");
  image.src = herb.image;
  image.alt = herb.alt || `Photo of ${herb.name}`;
  image.loading = "lazy";
  image.width = 600;
  image.height = 400;

  const body = makeElement("div", "card-body");
  body.append(
    makeElement("h3", "", herb.name),
    makeElement("p", "latin", herb.latin),
    makeElement("p", "card-description", herb.shortDescription),
    makeElement("p", "card-use", herb.use),
    makeElement("span", "pill", herb.life)
  );
  link.append(image, body);
  return link;
}

async function loadHerbCards() {
  status.textContent = "Loading herbs…";
  const results = await Promise.allSettled(herbSlugs.map(fetchHerb));
  const loaded = results
    .filter(result => result.status === "fulfilled")
    .map(result => result.value);

  cachedHerbs = loaded; 
  herbList.replaceChildren(...loaded.map(makeHerbCard));
  const failed = results.length - loaded.length;
  status.textContent = failed
    ? `${loaded.length} herbs loaded. ${failed} herb file(s) could not be loaded.`
    : `${loaded.length} herbs in the garden. Select a card or search by name.`;

  if (loaded.length === 0) {
    herbList.append(makeElement("p", "error",
      "The herb data could not be loaded. Run this website through a local web server and check the data folder."));
  }
}

function showError(message) {
  detailContent.replaceChildren();
  const error = makeElement("div", "error");
  error.setAttribute("role", "alert");
  error.append(
    makeElement("h2", "", "Sorry, we couldn't open this herb."),
    makeElement("p", "", message)
  );
  const link = makeElement("a", "back-link", "← All herbs");
  link.href = "#herbs";
  error.append(link);
  detailContent.append(error);
  detailSection.hidden = false;
  requestAnimationFrame(() => detailSection.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function renderHerb(herb) {
  detailContent.replaceChildren();
  const grid = makeElement("div", "detail-grid");
  const mainColumn = makeElement("div");
  const sideColumn = makeElement("aside", "detail-panel");

  const image = makeElement("img", "detail-image");
  image.src = herb.image;
  image.alt = herb.alt || `Photo of ${herb.name}`;
  image.width = 800;
  image.height = 600;

  mainColumn.append(
    image,
    makeElement("p", "eyebrow", "FROM THE GARDEN"),
    makeElement("h2", "", herb.name),
    makeElement("p", "latin", herb.latin),
    makeElement("p", "", herb.description),
    makeElement("h3", "", "How it is used"),
    makeElement("p", "", herb.use)
  );
  sideColumn.append(
    makeElement("h3", "", "Growing tips"),
    makeElement("p", "", herb.growingTips),
    makeElement("span", "pill", herb.life)
  );
  grid.append(mainColumn, sideColumn);
  detailContent.append(grid);
  detailSection.hidden = false;
  status.textContent = `Showing ${herb.name}.`;
  document.title = `${herb.name} | The Little Herb Garden`;
  requestAnimationFrame(() => detailSection.scrollIntoView({ behavior: "smooth", block: "start" }));
}

async function showSelectedHerb() {
  const slug = decodeURIComponent(location.hash.slice(1)).trim().toLowerCase();
  if (!slug || ["herbs", "visit", "about", "main"].includes(slug)) {
    detailSection.hidden = true;
    document.title = "The Little Herb Garden";
    return;
  }
  if (!/^[a-z-]+$/.test(slug)) {
    showError("That herb name is not valid.");
    return;
  }
  status.textContent = `Loading ${slug}…`;
  detailSection.hidden = false;
  detailContent.replaceChildren(makeElement("p", "", `Loading ${slug}…`));
  requestAnimationFrame(() => detailSection.scrollIntoView({ behavior: "smooth", block: "start" }));
  try {
    renderHerb(await fetchHerb(slug));
  } catch (error) {
    showError(location.protocol === "file:"
      ? "This page was opened directly as a file. Run “npx serve” in the project folder, then open the localhost URL."
      : (error.message || "Please check the herb data file and try again."));
    console.error("Herb loading failed:", error);
  }
}

function closeSuggestions() {
  suggestionBox.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
}

function renderSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  const matches = cachedHerbs.filter(herb =>
    !normalized ||
    herb.name.toLowerCase().includes(normalized) ||
    herb.slug.toLowerCase().includes(normalized) ||
    herb.latin.toLowerCase().includes(normalized)
  );

  suggestionBox.replaceChildren();
  if (!matches.length) {
    suggestionBox.append(makeElement("div", "suggestions-empty", "No matching herb. Try another name."));
    suggestionBox.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    return;
  }

  for (const herb of matches) {
    const option = makeElement("button", "suggestion-option");
    option.type = "button";
    option.setAttribute("role", "option");
    const leaf = makeElement("span", "suggestion-leaf", "✿");
    leaf.setAttribute("aria-hidden", "true");
    const copy = makeElement("span", "suggestion-copy");
    copy.append(
      makeElement("strong", "", herb.name),
      makeElement("small", "", herb.latin)
    );
    option.append(leaf, copy);
    option.addEventListener("click", () => {
      searchInput.value = herb.name;
      closeSuggestions();
      if (location.hash === `#${herb.slug}`) {
        renderHerb(herb);
      } else {
        location.hash = herb.slug;
      }
    });
    suggestionBox.append(option);
  }
  suggestionBox.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
}

searchInput.addEventListener("focus", () => renderSuggestions(searchInput.value));
searchInput.addEventListener("input", () => renderSuggestions(searchInput.value));
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSuggestions();
    return;
  }
  if (event.key === "ArrowDown" && !suggestionBox.hidden) {
    const first = suggestionBox.querySelector("button");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-input-wrap")) closeSuggestions();
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    status.textContent = "Please enter a herb name first.";
    searchInput.focus();
    return;
  }

  try {
    const allHerbs = cachedHerbs.length ? cachedHerbs : await Promise.all(herbSlugs.map(fetchHerb));
    const herb = allHerbs.find(item =>
      item.name.toLowerCase() === query ||
      item.slug.toLowerCase() === query ||
      item.latin.toLowerCase() === query
    );
    if (!herb) {
      status.textContent = `No herb found for "${searchInput.value}". Try basil, spearmint, rosemary, thyme, lavender, sage, chamomile or chives.`;
      searchInput.focus();
      return;
    }
    if (location.hash === `#${herb.slug}`) {
      renderHerb(herb);
    } else {
      location.hash = herb.slug;
    }
  } catch (error) {
    showError(error.message || "The herb data could not be loaded.");
  }
});

loadHerbCards().catch(error => {
  status.textContent = "The herb list could not be loaded. Check the project files and run a local server.";
  console.error(error);
});
showSelectedHerb();
window.addEventListener("hashchange", showSelectedHerb);


const yearElement = document.querySelector("#current-year");
if (yearElement) yearElement.textContent = new Date().getFullYear();


// Make footer navigation explicit and reliable, including herb detail links.
document.querySelector(".site-footer")?.addEventListener("click", async (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || !href.startsWith("#")) return;

  const targetName = decodeURIComponent(href.slice(1)).trim().toLowerCase();
  const herbSlug = herbSlugs.find(slug => slug === targetName);

  if (herbSlug) {
    event.preventDefault();
    try {
      const herb = cachedHerbs.find(item => item.slug === herbSlug) || await fetchHerb(herbSlug);
      if (location.hash !== `#${herbSlug}`) {
        history.pushState(null, "", `#${herbSlug}`);
      }
      renderHerb(herb);
    } catch (error) {
      showError(error.message || "The herb details could not be loaded.");
    }
    return;
  }

  const target = document.getElementById(targetName);
  if (target) {
    event.preventDefault();
    if (location.hash !== href) history.pushState(null, "", href);
    if (["herbs", "visit", "about", "main"].includes(targetName)) {
      detailSection.hidden = true;
      document.title = "The Little Herb Garden";
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (href === "#main") {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (location.hash !== "#main") history.pushState(null, "", "#main");
  }
});
