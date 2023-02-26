const { app, BrowserWindow, Tray, Menu, shell, dialog } = require("electron");
const { spawnWithWrapper } = require("ctrlc-wrapper");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { FgMagenta, Reset } = require("./colors");

global.baseURL = "";
global.serverStarted = false;

const logPrefix = FgMagenta + "[ PlutoApp:" + Reset;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// main process
app.on("ready", () => {
  startTime = Date.now();
  // hide dock icon
  if (process.platform == 'darwin') {
      app.dock.hide();
  }

  // Set up tray icon and menu
  const tray = new Tray(path.join(__dirname, "icons", "icon16-1.png"));

  tray.setToolTip("PlutoApp");
  var menu = newMenu("Server Starting");
  tray.setContextMenu(menu);

  var icons = [
    "icon16-1.png",
    "icon16-2.png",
    "icon16-3.png",
    "icon16-4.png"
  ]
  // loading animation, log only works if ms is a multiple of logEvery
  function loading(idx, startTime, ms, logEvery = 1000) {
    if (global.serverStarted) {
      tray.setImage(path.join(__dirname, "icons", "icon16-1.png"));
      console.log(logPrefix, "stopped loading animation");
    } else {
      setTimeout(() => {
        loading(
          idx + 1,
          startTime,
          ms,
          logEvery
          )
      }, ms)
      tray.setImage(path.join(__dirname, "icons", icons[idx % icons.length]))
    }
  }
  
  loading(0, startTime, 250);

  // Start pluto
  var julia = null;
  julia = startPluto(onFoundURL = () => {
    // update tray menu
    menu = newMenu("Server Running", true, () => {
      // quit app, but first kill julia
      // should trigger app.quit() on exit event
      julia.sendCtrlC();
    });
    tray.setContextMenu(menu);
    global.serverStarted = true;
    console.log(logPrefix, "global.serverStarted:", global.serverStarted);
    console.log(logPrefix, "global.baseURL:", global.baseURL);
    console.log(logPrefix, "done loading in", (Date.now() - startTime) / 1000, "s");
  });

});

// do nothing when all windows are closed
app.on("window-all-closed", () => {
  // do nothing, keep tray running
});

// do nothing when app is activated
app.on("activate", () => {
  // shouldn't happen, because we hide the dock icon
});

// create menu
function newMenu(
  serverStatus = "Not Running",
  ready = false,
  onQuit = app.quit
) {
  return Menu.buildFromTemplate([
    { label: serverStatus, enabled: false },
    {
      label: "Quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => {
        console.log(logPrefix, "Quitting");
        onQuit();
      },
    },
    { type: "separator" },
    {
      label: "Open in Browser",
      click: () => {
        console.log(logPrefix, "Opening External Window");
        shell.openExternal(global.baseURL);
      },
      enabled: ready,
    },
    {
      label: "Open File in Browser",
      click: () => {
        console.log(logPrefix, "Opening External Window");
        let furl = getURLToSelectedFile();
        if (furl != null) {
          shell.openExternal(furl);
        }
      },
      enabled: ready,
    }
  ]);
}

// start pluto server and return child process
// adds julia into exit sequence
function startPluto(onFoundURL = () => {}) {
  const paths = getJuliaPath();

  var child = spawnWithWrapper(
    paths.julia,
    [
      "-i",
      "--project=" + paths.project,
      "--threads=auto",
      "--color=yes",
      path.join(__dirname, "runPluto.jl")
    ],
    {
      cwd: path.join(os.homedir(), ".julia", "pluto_notebooks"),
      // encoding: "utf8",
      // shell: true,
      // detached: true
    }
  );

  // handle julia output
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data) => {
    listener(data, onFoundURL);
  });
  child.stderr.pipe(process.stdout);

  // handle ctrl-c in terminal
  // should wait for julia to stop
  // and run app.quit() on exit event
  process.on('SIGINT', () => {
    console.log(logPrefix, "Caught interrupt signal");
    child.sendCtrlC();
  });

  // should be final exit event if julia has started
  child.on("exit", function() {
    app.quit();
  })
  
  return child;
}

// listen for julia output to find the server url
// updates global.baseURL
// runs onFoundURL when found
function listener(data, onFoundURL = () => {}) {
  if (global.baseURL == "") {
    data = data.toString();
    if (data.includes("Go to http://")) {
      var strlist = data.split(" ");
      strlist.forEach((str) => {
        if (str.startsWith("http://")) {
          console.log(logPrefix, "server started");
          global.baseURL = str;
          onFoundURL();
        }
      });
    }
  }
}

// get julia path from juliaup config
// calls setupProjectDir
function getJuliaPath() {
  const home = os.homedir();
  // check if .julia/juliaup/juliaup.json exists
  const juliaupPath = path.join(home, ".julia", "juliaup");
  const juliaupConfigPath = path.join(juliaupPath, "juliaup.json");
  if (fs.existsSync(juliaupConfigPath)) {
    console.log(logPrefix, "juliaup.json found");
    const juliaupConfig = JSON.parse(fs.readFileSync(juliaupConfigPath, "utf8"));
    // console.log(logPrefix, juliaupConfig);
    const defaultChannel = juliaupConfig.Default;
    console.log(logPrefix, "default channel: " + defaultChannel);
    const defaultVersion = juliaupConfig.InstalledChannels[defaultChannel].Version;
    console.log(logPrefix, "default version: " + defaultVersion);
    const projectPath = setupProjectDir(defaultVersion);

    setupProjectDir(defaultVersion);

    // get julia path for windows
    if (process.platform == "win32") {
      var bin = "julia.exe";
    } else {
      var bin = "julia";
    }

    const juliaPath = path.join(juliaupPath, juliaupConfig.InstalledVersions[defaultVersion].Path, "bin", bin);
    console.log(logPrefix, "julia path: " + juliaPath);

    if (!fs.existsSync(juliaPath)) {
      // throw error
      throw new Error("Juliaup installed, but default julia binary not found");
    }
    return {
      julia: juliaPath,
      project: projectPath
    };
  } else {
    // throw error
    throw new Error("Juliaup not installed");
  }
}

// setup project directory for PlutoApp
// creates .julia/pluto_notebooks if it doesn't exist
// creates .julia/PlutoApp if it doesn't exist
// creates .julia/PlutoApp/environments/<version> if it doesn't exist
// creates .julia/PlutoApp/logs if it doesn't exist
// returns path to <version> project directory
function setupProjectDir(version) {
  const home = os.homedir();

  // create .julia/pluto_notebooks
  var dir = path.join(home, ".julia");
  if (!fs.existsSync(path.join(dir, "pluto_notebooks"))) {
    fs.mkdirSync(path.join(dir, "pluto_notebooks"));
  }

  // create .julia/PlutoApp/ and subdirectories
  dir = path.join(dir, "PlutoApp");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    fs.mkdirSync(path.join(dir, "logs"));
    fs.mkdirSync(path.join(dir, "environments"));
  }

  // create .julia/PlutoApp/environments/<version>
  dir = path.join(dir, "environments", version);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  return dir;
}

// takes a filepath and returns a url to open that file in pluto
// filepath is URI encoded as it is passed as a query parameter
function getURLToFile(filepath) {
  return global.baseURL.replace("/?", "/open?") + "&path=" + encodeURIComponent(filepath);
}

// opens a file dialog and returns the selected filepath
// returns null if no file is selected
// runs synchronously
function selectFile() {
  let response = dialog.showOpenDialogSync({properties: ['openFile'] })
  if (response != undefined) {
    console.log(logPrefix, "selected" + response[0]);
    return response[0];
  } else {
    console.log(logPrefix, "no file selected");
    return null;
  }
}

// returns url to selected file
function getURLToSelectedFile() {
  return getURLToFile(selectFile());
}
