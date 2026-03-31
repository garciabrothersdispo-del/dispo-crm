// electron.js — Desktop app wrapper
// Run with: npm run electron
// Build installer with: npm run electron:build

const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

// ── Change this to your Vercel URL after deploying ──
const APP_URL = 'https://your-dispo-crm.vercel.app'
// For local dev, use: 'http://localhost:3000'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0c0c0e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'public', 'icon-512.png'),
    title: 'DispoCRM Pro',
  })

  win.loadURL(APP_URL)

  // Hide menu bar on Windows/Linux
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }

  // Open devtools in dev mode
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
