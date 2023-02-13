const { app, BrowserWindow, Tray, Menu } = require("electron");
const { spawnWithWrapper } = require("ctrlc-wrapper");
const path = require("path");
const os = require("os");
const fs = require("fs");

global.baseURL = "";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

function createWindow(url, dev = false) {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  //mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.loadURL(url);

  // Open the DevTools.
  if (dev) {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  // hide dock icon
  if (process.platform == 'darwin') {
      app.dock.hide();
  } else {
      app.skipTaskbar(true);
  }

  // Set up tray icon and menu
  const tray = new Tray(path.join(__dirname, "icon16.png"));
  var menu = newMenu("Server Starting");
  tray.setContextMenu(menu);

  // Start pluto
  var julia = null;
  julia = startPluto(onFoundURL = () => {
    // createWindow(global.baseURL);
    menu = newMenu("Server Running", true, julia.sendCtrlC, global.baseURL);
    tray.setContextMenu(menu);
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  // do nothing, keep tray running
});

app.on("activate", () => {
  // shouldn't happen, because we hide the dock icon
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function newMenu(
  serverStatus = "Not Running",
  ready = false,
  onQuit = app.quit,
  url = "https://google.com"
) {
  return Menu.buildFromTemplate([
    { label: serverStatus, enabled: false },
    {
      label: "Quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => {
        console.log("Quitting");
        onQuit();
      },
    },
    { type: "separator" },
    {
      label: "Open App",
      click: () => {
        console.log("Opening Window");
        createWindow(url);
      },
      enabled: ready,
    },
    {
      label: "Open App with Dev Tools",
      click: () => {
        console.log("Opening Window");
        createWindow(url, true);
      },
      enabled: ready,
    },
    {
      label: "Open Terminal",
      click: () => {
        // TODO: Open terminal
        console.log("Open Terminal");
      },
    },
  ]);
}

function startPluto(onFoundURL = () => {}) {
  //exec("juliaup config channelsymlinks true");
  //exec("juliaup add beta");

  var juliaPath = getJuliaPath();

  var child = spawnWithWrapper(
    juliaPath,
    ["-i", path.join(__dirname, "runPluto.jl")],
    {
      encoding: "utf8",
      // shell: true,
      // detached: true
    }
  );

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data) => {
    listener(data, onFoundURL);
  });
  child.stderr.pipe(process.stdout);

  child.on("exit", function() {
    app.quit();
  })
  
  return child;
}

function listener(data, onFoundURL = () => {}) {
  if (global.baseURL == "") {
    data = data.toString();
    if (data.includes("Go to http://")) {
      var strlist = data.split(" ");
      strlist.forEach((str) => {
        if (str.startsWith("http://")) {
          console.log("server started");
          global.baseURL = str;
          onFoundURL();
        }
      });
    }
  }
}

function getJuliaPath() {
  const home = os.homedir();
  // check if .julia/juliaup/juliaup.json exists
  const juliaupPath = path.join(home, ".julia", "juliaup");
  const juliaupConfigPath = path.join(juliaupPath, "juliaup.json");
  if (fs.existsSync(juliaupConfigPath)) {
    console.log("juliaup.json found");
    const juliaupConfig = JSON.parse(fs.readFileSync(juliaupConfigPath, "utf8"));
    console.log(juliaupConfig);
    const defaultChannel = juliaupConfig.Default;
    console.log("default channel: " + defaultChannel);
    const defaultVersion = juliaupConfig.InstalledChannels[defaultChannel].Version;
    console.log("default version: " + defaultVersion);
    const juliaPath = path.join(juliaupPath, juliaupConfig.InstalledVersions[defaultVersion].Path, "bin", "julia");
    console.log("julia path: " + juliaPath);

    if (!fs.existsSync(juliaPath)) {
      // throw error
      throw new Error("Juliaup installed, but default julia binary not found");
    }
    return juliaPath;
  } else {
    // throw error
    throw new Error("Juliaup not installed");
  }
}
