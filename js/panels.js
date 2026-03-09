(function initPanels() {
  var panelsRoot = document.getElementById("panels");
  var backButton = document.getElementById("back-btn");

  // Panel scroll progress bar
  var progressBar = document.createElement("div");
  progressBar.id = "panel-progress";
  document.body.appendChild(progressBar);
  var activeScrollPanel = null;
  function updateProgress() {
    if (!activeScrollPanel) {
      progressBar.style.opacity = "0";
      return;
    }
    var rect = activeScrollPanel.getBoundingClientRect();
    var max = activeScrollPanel.scrollHeight - activeScrollPanel.clientHeight;
    var pct = max > 4 ? activeScrollPanel.scrollTop / max : 0;
    progressBar.style.top = rect.top + "px";
    progressBar.style.left = rect.right - 2 + "px";
    progressBar.style.height = rect.height * pct + "px";
    progressBar.style.opacity = max > 4 ? "1" : "0";
  }

  Orbital.panelElements = {
    about: document.getElementById("about-panel"),
    projects: document.getElementById("projects-panel"),
    skills: document.getElementById("skills-panel"),
    contact: document.getElementById("contact-panel"),
  };

  Orbital.openPanel = function openPanel(panelId) {
    Object.keys(Orbital.panelElements).forEach(function (key) {
      Orbital.panelElements[key].classList.remove("open");
    });
    if (activeScrollPanel) {
      activeScrollPanel.removeEventListener("scroll", updateProgress);
    }
    var panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add("open");
      Orbital.focusedPanelId = panelId;
      panelsRoot.classList.add("has-open");
      panel.scrollTop = 0;
      activeScrollPanel = panel;
      panel.addEventListener("scroll", updateProgress);
      updateProgress();
    }
    backButton.classList.add("visible");
  };

  Orbital.closePanels = function closePanels() {
    Object.keys(Orbital.panelElements).forEach(function (key) {
      Orbital.panelElements[key].classList.remove("open");
    });
    if (activeScrollPanel) {
      activeScrollPanel.removeEventListener("scroll", updateProgress);
      activeScrollPanel = null;
    }
    progressBar.style.opacity = "0";
    Orbital.focusedPanelId = null;
    panelsRoot.classList.remove("has-open");
    backButton.classList.remove("visible");
  };
})();
