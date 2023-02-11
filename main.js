const electron = require('electron');
const { Tray, app, Menu, BrowserWindow } = electron;
const { exec } = require('child_process');
const { spawnWithWrapper } = require('ctrlc-wrapper');

global.url = "";

const createMainWindow = (url) => {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    })
    mainWindow.loadURL(url);
}

app.on('ready', () => {
    function newMenu(serverStatus, ready = false, onQuit = app.quit) {
        return [
            { label: serverStatus, enabled: false },
            { type: 'separator' },
            { label: 'Open App', click: () => {
                console.log('Opening Window');
                createMainWindow(global.url);
            }, enabled: ready },
            { label: 'Open Terminal', click: () => { console.log('Open Terminal'); } },
            { label: 'Quit', click: onQuit}
        ]
    }

    // if (process.platform == 'darwin') {
    //     app.dock.hide();
    // } else {
    //     app.skipTaskbar(true);
    // }

    const tray = new Tray('./icons/icon16.png');
  
    var menu = Menu.buildFromTemplate(newMenu('Server Starting'));

    tray.setContextMenu(menu);

    try {
        var julia = startPluto();
    } catch (error) {
        console.log('failed to start pluto');
        app.exit();
    }

    

    julia.stderr.setEncoding('utf8');
    julia.stderr.on('data', (data) => {
        if (global.url == "") {
            data = data.toString().split(" ");
            data.forEach(str => {
                if (str.startsWith('http://')) {
                    menu = Menu.buildFromTemplate(newMenu(
                        'Server Running',
                        ready = true,
                        onQuit = julia.sendCtrlC
                        ));
                    tray.setContextMenu(menu);
                    global.url = str;
                    console.log('server started at ' + global.url);
                    return 0;
                }
            });
        }
    });
    julia.stderr.pipe(process.stdout);

    app.on('window-all-closed', () => {
        //if (process.platform !== 'darwin') app.quit()
        //julia.sendCtrlC();
    })

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow(url)
    })

    julia.on('exit', function() {
        app.quit();
    })
});

function startPluto() {
    exec('juliaup config channelsymlinks true');
    exec('juliaup add beta');

    var child = spawnWithWrapper(
        'julia-beta',
        ['-i', 'server.jl'],
        { 
            encoding: 'utf8',
            //shell: true,
            //detached: true
        }
    );

    return child;
}

function watchOut(data) {
    if (url == "") {
        data = data.toString();
        if (data.includes('Go to http://')) {
            var strlist = data.split(" ");
            strlist.forEach(str => {
                if (str.startsWith('http://')) {

                console.log('server started');
                menu = Menu.buildFromTemplate(newMenu('Server Running'));
                tray.setContextMenu(menu);
                    global.url = str;
                    return 0;
                }
            });
        }
    } else {
        if (data.includes('[ Info: end of file')) {
            serverStopped = true;
        }
    }
}