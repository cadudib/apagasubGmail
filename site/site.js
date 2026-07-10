const reveals = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

reveals.forEach((element) => observer.observe(element));
document.querySelector("#currentYear").textContent = new Date().getFullYear();

fetch("/version.json", { cache: "no-store" })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("version unavailable")))
  .then(({ version }) => {
    document.querySelectorAll("[data-version]").forEach((element) => {
      element.textContent = `V${version}`;
    });
  })
  .catch(() => {});
