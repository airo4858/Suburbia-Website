const root = document.documentElement;
const header = document.querySelector("header");
const hero = document.querySelector("[data-parallax-hero]");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");

function syncHeaderHeight() {
    if (!header) {
        return;
    }

    root.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

function enableHeroParallax() {
    if (!hero || motionQuery.matches) {
        return;
    }

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let frameId = null;
    const maxShift = 18;

    function animate() {
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;

        hero.style.setProperty("--hero-shift-x", `${currentX.toFixed(2)}px`);
        hero.style.setProperty("--hero-shift-y", `${currentY.toFixed(2)}px`);

        const isSettled =
            Math.abs(targetX - currentX) < 0.1 &&
            Math.abs(targetY - currentY) < 0.1;

        if (isSettled) {
            frameId = null;
            return;
        }

        frameId = window.requestAnimationFrame(animate);
    }

    function queueAnimation() {
        if (frameId === null) {
            frameId = window.requestAnimationFrame(animate);
        }
    }

    function updateTarget(event) {
        if (event.pointerType && event.pointerType !== "mouse") {
            return;
        }

        const bounds = hero.getBoundingClientRect();
        const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
        const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;

        targetX = offsetX * -maxShift;
        targetY = offsetY * -maxShift;

        queueAnimation();
    }

    hero.addEventListener("pointermove", updateTarget);
    hero.addEventListener("pointerleave", () => {
        targetX = 0;
        targetY = 0;
        queueAnimation();
    });
}

function enableDropdowns() {
    const dropdowns = document.querySelectorAll(".dropdown");

    if (dropdowns.length === 0) {
        return;
    }

    function closeDropdowns() {
        dropdowns.forEach((dropdown) => {
            dropdown.classList.remove("is-open");
            const trigger = dropdown.querySelector(".dropbtn");

            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
            }
        });
    }

    dropdowns.forEach((dropdown) => {
        const trigger = dropdown.querySelector(".dropbtn");

        if (!trigger) {
            return;
        }

        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");

        trigger.addEventListener("click", (event) => {
            if (!touchQuery.matches) {
                return;
            }

            const isOpen = dropdown.classList.contains("is-open");

            if (!isOpen) {
                event.preventDefault();
                closeDropdowns();
                dropdown.classList.add("is-open");
                trigger.setAttribute("aria-expanded", "true");
            }
        });
    });

    document.addEventListener("click", (event) => {
        const clickedInsideDropdown = Array.from(dropdowns).some((dropdown) =>
            dropdown.contains(event.target)
        );

        if (!clickedInsideDropdown) {
            closeDropdowns();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDropdowns();
        }
    });
}

function enableExactSectionLinks() {
    const trailer = document.querySelector("#trailer");
    const trailerLinks = document.querySelectorAll('a[href="#trailer"]');

    if (!trailer || trailerLinks.length === 0) {
        return;
    }

    trailerLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();

            const top = trailer.getBoundingClientRect().top + window.scrollY;

            window.scrollTo({
                top,
                behavior: motionQuery.matches ? "auto" : "smooth",
            });

            window.history.replaceState(null, "", "#trailer");
        });
    });
}

function enhanceDocumentationLayout() {
    const about = document.querySelector("#about");

    if (!about || about.querySelector(".docs-gallery")) {
        return;
    }

    const children = Array.from(about.children);
    const title = children.find((child) => child.matches("h2"));
    const titleIndex = title ? children.indexOf(title) : -1;
    const intro =
        titleIndex >= 0
            ? children.find(
                  (child, index) => index > titleIndex && child.matches("p")
              )
            : null;
    const headings = children.filter((child) => child.matches("h3"));

    if (!title || !intro || headings.length === 0) {
        return;
    }

    const overview = document.createElement("div");
    const gallery = document.createElement("div");
    const modal = document.createElement("div");
    const chapters = new Map();
    const openingSections = [];
    const closingSections = [];
    let lastFocusedElement = null;
    let tileCount = 0;

    overview.className = "docs-overview";
    gallery.className = "docs-gallery";
    modal.className = "doc-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    modal.innerHTML = `
        <div class="doc-modal__backdrop" data-doc-close></div>
        <div class="doc-modal__panel" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title">
            <div class="doc-modal__media"></div>
            <div class="doc-modal__content">
                <div class="doc-modal__top">
                    <div class="doc-modal__heading">
                        <p class="doc-modal__eyebrow">Documentation</p>
                        <h3 class="doc-modal__title" id="doc-modal-title"></h3>
                    </div>
                    <button class="doc-modal__close" type="button" aria-label="Close documentation chapter" data-doc-close>
                        Close
                    </button>
                </div>
                <div class="doc-modal__body" tabindex="0"></div>
            </div>
        </div>
    `;

    overview.append(title, intro);

    function createExcerpt(text) {
        const normalized = text.replace(/\s+/g, " ").trim();

        if (normalized.length <= 130) {
            return normalized;
        }

        return `${normalized.slice(0, 127).trimEnd()}...`;
    }

    function createInlineChapter(heading, bodyNodes, isEnding = false) {
        const section = document.createElement("article");
        const body = document.createElement("div");

        section.className = "docs-inline";

        if (isEnding) {
            section.classList.add("docs-inline--ending");
        }

        body.className = "docs-inline__body";
        section.append(heading, body);

        bodyNodes.forEach((node) => {
            body.append(node);
        });

        body.querySelectorAll("ol, ul").forEach((list) => {
            list.classList.add("docs-inline__list");
        });

        return section;
    }

    headings.forEach((heading, index) => {
        const headingIndex = children.indexOf(heading);
        const nextHeadingIndex =
            index < headings.length - 1
                ? children.indexOf(headings[index + 1])
                : children.length;
        const bodyNodes = children.slice(headingIndex + 1, nextHeadingIndex);
        const tile = document.createElement("button");
        const tileImage = document.createElement("div");
        const tileOverlay = document.createElement("div");
        const tileTitle = document.createElement("p");
        const tileExcerpt = document.createElement("p");
        const firstParagraph = bodyNodes.find((node) => node.matches("p"));
        const sectionImages = bodyNodes.filter((node) => node.matches("img"));
        const assignedImage = sectionImages[0] || null;
        const contentHTML = bodyNodes.map((node) => node.outerHTML).join("");
        const cleanTitle = heading.textContent.replace(/:$/, "").trim();
        const excerpt = firstParagraph
            ? createExcerpt(firstParagraph.textContent)
            : "";

        if (!assignedImage && index === 0) {
            openingSections.push(createInlineChapter(heading, bodyNodes));
            return;
        }

        if (!assignedImage && index === headings.length - 1) {
            closingSections.push(createInlineChapter(heading, bodyNodes, true));
            return;
        }

        chapters.set(heading.id, {
            id: heading.id,
            title: cleanTitle,
            image: assignedImage
                ? {
                      src: assignedImage.getAttribute
                          ? assignedImage.getAttribute("src")
                          : assignedImage.src,
                      alt: assignedImage.getAttribute
                          ? assignedImage.getAttribute("alt") || cleanTitle
                          : assignedImage.alt || cleanTitle,
                  }
                : null,
            contentHTML,
        });

        tile.type = "button";
        tile.className = "doc-tile";
        tile.dataset.docId = heading.id;

        if (tileCount === 0) {
            tile.classList.add("doc-tile--feature");
        } else if (tileCount % 4 === 3) {
            tile.classList.add("doc-tile--wide");
        }

        tileCount += 1;

        tileImage.className = "doc-tile__image";

        if (assignedImage) {
            const image = document.createElement("img");

            image.src = assignedImage.getAttribute
                ? assignedImage.getAttribute("src")
                : assignedImage.src;
            image.alt = "";
            tileImage.append(image);
        } else {
            tileImage.classList.add("doc-tile__image--fallback");
        }

        tileOverlay.className = "doc-tile__overlay";
        tileTitle.className = "doc-tile__title";
        tileTitle.textContent = cleanTitle;
        tileExcerpt.className = "doc-tile__excerpt";
        tileExcerpt.textContent = excerpt;

        tileOverlay.append(tileTitle);

        if (excerpt) {
            tileOverlay.append(tileExcerpt);
        }

        tile.append(tileImage, tileOverlay);
        gallery.append(tile);
    });

    about.replaceChildren(overview, ...openingSections, gallery, ...closingSections, modal);

    const modalMedia = modal.querySelector(".doc-modal__media");
    const modalBody = modal.querySelector(".doc-modal__body");
    const modalTitle = modal.querySelector(".doc-modal__title");
    const closeTargets = modal.querySelectorAll("[data-doc-close]");

    function decorateModalContent(container) {
        container.querySelectorAll("ol, ul").forEach((list) => {
            list.classList.add("doc-modal__list");
        });

        container.querySelectorAll("img").forEach((image) => {
            const frame = document.createElement("div");

            frame.className = "doc-modal__image-frame";
            image.replaceWith(frame);
            frame.append(image);
        });
    }

    function openModal(id, shouldUpdateHash = true) {
        const chapter = chapters.get(id);

        if (!chapter) {
            return;
        }

        lastFocusedElement = document.activeElement;
        modalTitle.textContent = chapter.title;
        modalBody.innerHTML = chapter.contentHTML;
        decorateModalContent(modalBody);
        modalMedia.replaceChildren();
        modalBody.scrollTop = 0;

        if (chapter.image) {
            const image = document.createElement("img");

            image.src = chapter.image.src;
            image.alt = chapter.image.alt;
            modalMedia.append(image);
            modalMedia.hidden = false;
        } else {
            modalMedia.hidden = true;
        }

        modal.hidden = false;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        if (shouldUpdateHash) {
            window.history.replaceState(null, "", `#${chapter.id}`);
        }

        const closeButton = modal.querySelector(".doc-modal__close");

        if (closeButton) {
            closeButton.focus();
        }
    }

    function closeModal(shouldUpdateHash = true) {
        if (modal.hidden) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modal.hidden = true;
        document.body.classList.remove("modal-open");

        if (shouldUpdateHash && chapters.has(window.location.hash.slice(1))) {
            window.history.replaceState(null, "", "#about");
        }

        if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
            lastFocusedElement.focus();
        }
    }

    gallery.querySelectorAll(".doc-tile").forEach((tile) => {
        tile.addEventListener("click", () => {
            const { docId } = tile.dataset;

            if (docId) {
                openModal(docId);
            }
        });
    });

    closeTargets.forEach((target) => {
        target.addEventListener("click", () => {
            closeModal();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });

    chapters.forEach((chapter, id) => {
        document.querySelectorAll(`a[href="#${id}"]`).forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                about.scrollIntoView({
                    behavior: motionQuery.matches ? "auto" : "smooth",
                    block: "start",
                });
                openModal(id);
            });
        });
    });

    function syncHashToModal() {
        const hash = window.location.hash.slice(1);

        if (chapters.has(hash)) {
            about.scrollIntoView({
                behavior: "auto",
                block: "start",
            });
            openModal(hash, false);
        } else {
            closeModal(false);

            if (hash && hash !== "about") {
                const target = document.getElementById(hash);

                if (target) {
                    target.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
                }
            }
        }
    }

    window.addEventListener("hashchange", syncHashToModal);
    syncHashToModal();
}

syncHeaderHeight();
enhanceDocumentationLayout();
enableHeroParallax();
enableDropdowns();
enableExactSectionLinks();

window.addEventListener("resize", syncHeaderHeight);
