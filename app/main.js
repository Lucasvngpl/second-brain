import { app, BrowserWindow, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __dirname = dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,

    // macOS vibrancy — the OS blurs whatever is physically behind the window
    // (wallpaper, other apps). This is the native NSVisualEffectView equivalent.
    vibrancy: 'under-window',
    visualEffectState: 'active', // keep blur active even when window loses focus

    // transparent: true is required for vibrancy to show through.
    // Without it, Electron fills the window with a solid background.
    transparent: true,
    backgroundColor: '#00000000',

    // hiddenInset: hide the default title bar but keep the traffic lights
    // inset into the window content area (so our glass card can host them).
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },

    roundedCorners: true,

    webPreferences: {
      nodeIntegration: false,  // never expose Node APIs to renderer
      contextIsolation: true,  // renderer runs in a separate context
    },
  })

  if (!app.isPackaged) {
    // Dev: load Vite dev server (hot reload, source maps)
    win.loadURL('http://localhost:5173')
  } else {
    // Production: load the built HTML file from disk
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Open all <a target="_blank"> links in the system browser, not a new Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  // macOS: clicking the dock icon when no windows are open should reopen the window
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit on all windows closed — except on macOS where apps stay alive in the dock
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
