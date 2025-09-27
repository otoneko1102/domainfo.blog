import { fetchWithAuth } from "../auth.js";

export async function loadPrivateMedia(container, options = {}) {
  const { showLoadingScreen = false } = options;
  let scrollY = 0;

  const mediaElements = Array.from(container.querySelectorAll("[data-src]"));

  if (showLoadingScreen) {
    scrollY = window.scrollY;
    document.body.classList.remove("loaded");
    document.body.classList.add("loading");
  }

  let loadedCount = 0;
  const totalElements = mediaElements.length;

  const finalise = () => {
    if (showLoadingScreen) {
      document.body.classList.remove("loading");
      document.body.classList.add("loaded");
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
  };

  const loadElement = async (el) => {
    const realSrc = el.dataset.src;
    if (!realSrc) {
      loadedCount++;
      if (loadedCount === totalElements) finalise();
      return;
    }

    try {
      const response = await fetchWithAuth(realSrc);
      if (!response.ok) throw new Error(`Network error for ${realSrc}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      el.src = blobUrl;

      el.onload = () => URL.revokeObjectURL(blobUrl);
      el.onerror = () => URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to load private media:", realSrc, error);
      if (el.alt) el.alt = `[メディアの読み込み失敗] ${el.alt}`;
    } finally {
      loadedCount++;
      if (loadedCount === totalElements) {
        finalise();
      }
    }
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          obs.unobserve(el);

          loadElement(el);
        }
      });
    });
    mediaElements.forEach((el) => observer.observe(el));
  } else {
    console.warn(
      "IntersectionObserver not supported, loading all media at once.",
    );
    mediaElements.forEach((el) => loadElement(el));
  }
}
