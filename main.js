// Variable globale contenant l'arborescence complète
let originalTreeData = [];

// Mapping du numéro de classe aux libellés
const classMapping = {
  "1": "Comptes de ressources durables",
  "2": "Comptes d'actif immobilisé",
  "3": "Comptes de stocks",
  "4": "Comptes de tiers",
  "5": "Comptes de trésorerie",
  "6": "Comptes de charges",
  "7": "Comptes de produits",
  "8": "Comptes divers",
  "9": "Comptes des engagements et CAGE"
};

// Fonction qui supprime les accents pour rendre la recherche tolérante
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Parse le CSV et retourne un tableau d'objets { code, label }
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const accounts = [];
  let start = 0;
  if (lines[0].toLowerCase().includes("numéro") || lines[0].toLowerCase().includes("intitulé")) {
    start = 1;
  }
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length >= 2) {
      accounts.push({
        code: parts[0].trim(),
        label: parts[1].trim()
      });
    }
  }
  return accounts;
}

// Construit l'arborescence en regroupant les comptes par le préfixe
function buildAccountTree(accounts) {
  accounts.sort((a, b) => a.code.localeCompare(b.code));
  const nodeMap = {};
  const roots = [];
  accounts.forEach(acc => {
    nodeMap[acc.code] = { code: acc.code, label: acc.label, children: [] };
  });
  accounts.forEach(acc => {
    const code = acc.code;
    let parentFound = false;
    for (let i = code.length - 1; i > 0; i--) {
      const parentCode = code.substring(0, i);
      if (nodeMap[parentCode]) {
        nodeMap[parentCode].children.push(nodeMap[code]);
        parentFound = true;
        break;
      }
    }
    if (!parentFound) {
      roots.push(nodeMap[acc.code]);
    }
  });
  return roots;
}

// Affiche l'arborescence dans le conteneur donné (fonction récursive)
function renderTree(nodes, container) {
  container.innerHTML = "";
  nodes.forEach(node => {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "node";
    if (node.code.charAt(0) === "9") {
      nodeDiv.classList.add("class9");
    }
    nodeDiv.textContent = node.code + " - " + node.label;
    nodeDiv.addEventListener("click", function(e) {
      e.stopPropagation();
      updateClassInfo(node);
      // Bascule l'affichage des enfants (s'il y en a)
      const nextElem = nodeDiv.nextElementSibling;
      if (nextElem && nextElem.classList.contains("children")) {
        nextElem.style.display = nextElem.style.display === "none" ? "block" : "none";
      }
    });
    container.appendChild(nodeDiv);
    if (node.children && node.children.length > 0) {
      const childContainer = document.createElement("div");
      childContainer.className = "children";
      childContainer.style.display = "none";
      renderTree(node.children, childContainer);
      container.appendChild(childContainer);
    }
  });
}

// Met à jour la zone d'information en haut avec le numéro et le nom de la classe
function updateClassInfo(node) {
  const classNumber = node.code.charAt(0);
  const className = classMapping[classNumber] || "Classe inconnue";
  document.getElementById("classSelect").value = classNumber;
  document.getElementById("classLabel").textContent = className;
}

// Filtre l'arborescence par classe uniquement (retourne les nœuds dont le premier chiffre correspond)
function filterByClass(nodes, selectedClass) {
  return nodes.filter(node => node.code.charAt(0) === selectedClass);
}

// Fonction récursive pour filtrer tolérant aux accents et appliquant la recherche
function filterTree(nodes, query) {
  const filtered = [];
  nodes.forEach(node => {
    const normCode = removeAccents(node.code.toLowerCase());
    const normLabel = removeAccents(node.label.toLowerCase());
    const normQuery = removeAccents(query);
    const childrenFiltered = filterTree(node.children, query);
    const matches = normCode.includes(normQuery) || normLabel.includes(normQuery);
    if (matches || childrenFiltered.length > 0) {
      filtered.push({
        ...node,
        children: childrenFiltered
      });
    }
  });
  return filtered;
}

// Combine le filtrage par classe et par texte de recherche et rafraîchit l'affichage
function filterTreeByClassAndSearch() {
  let filteredTree = originalTreeData;
  const classSelectValue = document.getElementById("classSelect").value;
  const searchQuery = document.getElementById("searchInput").value.trim().toLowerCase();
  
  if (classSelectValue !== "all") {
    filteredTree = filterByClass(filteredTree, classSelectValue);
  }
  if (searchQuery !== "") {
    filteredTree = filterTree(filteredTree, searchQuery);
  }
  renderTree(filteredTree, document.getElementById("treeResults"));
}

// Charge automatiquement le fichier CSV et construit l'arborescence
function loadAccounts() {
  fetch("plan_co.csv")
    .then(response => response.text())
    .then(text => {
      const accounts = parseCSV(text);
      originalTreeData = buildAccountTree(accounts);
      renderTree(originalTreeData, document.getElementById("treeResults"));
    })
    .catch(error => {
      console.error("Erreur lors du chargement du CSV :", error);
      document.getElementById("treeResults").innerHTML = "<p style='color:red;'>Erreur de chargement du fichier CSV.</p>";
    });
}

// Événement sur la zone de recherche
document.getElementById("searchInput").addEventListener("input", filterTreeByClassAndSearch);

// Événement sur le sélecteur de classe : lors d'un changement, mettre à jour le libellé et filtrer
document.getElementById("classSelect").addEventListener("change", function() {
  const selectedValue = this.value;
  if (selectedValue === "all") {
    document.getElementById("classLabel").textContent = "Toutes les classes";
  } else {
    document.getElementById("classLabel").textContent = classMapping[selectedValue] || "Classe inconnue";
  }
  filterTreeByClassAndSearch();
});

// Lancer le chargement dès que le DOM est prêt
document.addEventListener("DOMContentLoaded", loadAccounts);

// Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('service-worker.js').then(function(registration) {
      console.log('Service Worker enregistré :', registration.scope);
    }, function(err) {
      console.log('Échec de l’enregistrement du Service Worker :', err);
    });
  });
}
