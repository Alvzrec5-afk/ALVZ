// ALVZ Studio pour Mac : une fenêtre qui affiche le studio (alvzgalleries.com/admin), avec un vrai menu,
// des raccourcis, les téléchargements rangés dans « Téléchargements » et la fenêtre qui retrouve sa place.
// Tout le reste (galeries, tableaux, site…) vient du site en ligne : l'application n'a pas besoin d'être refaite
// quand le studio change.
const { app, BrowserWindow, Menu, shell, session, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const ORIGIN = "https://alvzgalleries.com";
const HOME = `${ORIGIN}/admin`;
const stateFile = () => path.join(app.getPath("userData"), "window.json");

let win = null;

/** Place et taille de la fenêtre à la dernière fermeture. */
function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1440, height: 900 };
  }
}
function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds()));
  } catch {}
}

/** Adresse du studio ? (le reste s'ouvre dans le navigateur : WhatsApp, Instagram, alvzrec.com…) */
const isStudio = (url) => {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
};

function createWindow() {
  win = new BrowserWindow({
    ...loadBounds(),
    minWidth: 900,
    minHeight: 600,
    title: "ALVZ Studio",
    backgroundColor: "#0e0e0d",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.once("ready-to-show", () => win.show());
  win.on("close", saveBounds);
  win.on("closed", () => (win = null));

  // Liens vers un autre site : navigateur par défaut. Liens du studio ouverts « dans un nouvel onglet » : nouvelle fenêtre.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isStudio(url)) return { action: "allow", overrideBrowserWindowOptions: { backgroundColor: "#0e0e0d" } };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (isStudio(url) || url.startsWith("file:")) return;
    e.preventDefault();
    shell.openExternal(url);
  });

  // Pas de réseau : petite page « Réessayer » au lieu d'une fenêtre blanche.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* chargement annulé */ && isStudio(url)) win.loadFile(path.join(__dirname, "offline.html"));
  });

  win.loadURL(HOME);
}

/** Téléchargements (photos, ZIP, documents) : directement dans « Téléchargements », progression sur l'icône du Dock. */
function handleDownloads() {
  session.defaultSession.on("will-download", (_e, item) => {
    const dir = app.getPath("downloads");
    const ext = path.extname(item.getFilename());
    const base = path.basename(item.getFilename(), ext);
    let target = path.join(dir, item.getFilename());
    for (let n = 2; fs.existsSync(target); n++) target = path.join(dir, `${base} (${n})${ext}`);
    item.setSavePath(target);
    item.on("updated", () => {
      const total = item.getTotalBytes();
      if (win && total > 0) win.setProgressBar(item.getReceivedBytes() / total);
    });
    item.once("done", (_ev, state) => {
      if (win) win.setProgressBar(-1);
      if (state === "completed") {
        app.dock?.downloadFinished(target);
        app.dock?.bounce("informational");
      } else if (state === "interrupted") {
        dialog.showErrorBox("Téléchargement interrompu", item.getFilename());
      }
    });
  });
}

/** Le studio peut lire et écrire le presse-papiers (copier-coller des tableaux), afficher des notifications, etc. */
function handlePermissions() {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(isStudio(wc.getURL()) && ["clipboard-read", "clipboard-sanitized-write", "notifications", "fullscreen", "media"].includes(permission));
  });
}

function go(pathname) {
  if (!win) createWindow();
  win.loadURL(`${ORIGIN}${pathname}`);
  win.show();
}

function buildMenu() {
  const template = [
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "Aller",
      submenu: [
        { label: "Accueil", accelerator: "Cmd+1", click: () => go("/admin") },
        { label: "Galeries", accelerator: "Cmd+2", click: () => go("/admin/galleries") },
        { label: "Vidéos", accelerator: "Cmd+3", click: () => go("/admin/videos") },
        { label: "Tableaux", accelerator: "Cmd+4", click: () => go("/admin/boards") },
        { label: "Site", accelerator: "Cmd+5", click: () => go("/admin/site") },
        { type: "separator" },
        { label: "Page précédente", accelerator: "Cmd+[", click: () => win?.webContents.navigationHistory.goBack() },
        { label: "Page suivante", accelerator: "Cmd+]", click: () => win?.webContents.navigationHistory.goForward() },
      ],
    },
    {
      label: "Présentation",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "forceReload", label: "Recharger sans le cache" },
        { type: "separator" },
        { role: "resetZoom", label: "Taille réelle" },
        { role: "zoomIn", label: "Agrandir" },
        { role: "zoomOut", label: "Réduire" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
        { role: "toggleDevTools", label: "Outils de développement" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Une seule fenêtre de l'application à la fois : un second lancement ramène la première.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    buildMenu();
    handleDownloads();
    handlePermissions();
    createWindow();
  });
  // Mac : fermer la fenêtre garde l'application dans le Dock ; un clic sur l'icône la rouvre.
  app.on("activate", () => {
    if (!win) createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
