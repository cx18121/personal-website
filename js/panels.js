(function initPanels() {
  var panelsRoot = document.getElementById("panels");
  var backButton = document.getElementById("back-btn");

  Orbital.panelElements = {
    about: document.getElementById("about-panel"),
    projects: document.getElementById("projects-panel"),
    skills: document.getElementById("skills-panel"),
  };

  Orbital.openPanel = function openPanel(panelId) {
    Object.keys(Orbital.panelElements).forEach(function (key) {
      Orbital.panelElements[key].classList.remove("open");
    });
    var panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add("open");
      Orbital.focusedPanelId = panelId;
      panelsRoot.classList.add("has-open");
      panel.scrollTop = 0;
    }
    backButton.classList.add("visible");
    document.title = 'Charlie Xue';
  };

  Orbital.closePanels = function closePanels() {
    Object.keys(Orbital.panelElements).forEach(function (key) {
      Orbital.panelElements[key].classList.remove("open");
    });
    Orbital.focusedPanelId = null;
    panelsRoot.classList.remove("has-open");
    backButton.classList.remove("visible");
    document.title = 'Charlie Xue';
  };
})();
