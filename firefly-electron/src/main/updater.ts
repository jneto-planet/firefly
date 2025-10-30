// src/main/updater.ts
import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";

export class AppUpdater {
  constructor() {
    // Configure auto-updater
    autoUpdater.checkForUpdatesAndNotify();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // When update is available
    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      this.showUpdateAvailableDialog(info);
    });

    // When update is not available
    autoUpdater.on('update-not-available', (info) => {
      console.log('[updater] Update not available:', info.version);
    });

    // When update is downloaded
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
      this.showUpdateReadyDialog(info);
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`[updater] Download progress: ${percent}%`);
      
      // Update window title with progress
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].setTitle(`Firefly - Downloading update ${percent}%`);
      }
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      console.error('[updater] Error:', error);
    });
  }

  private showUpdateAvailableDialog(info: any) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    dialog.showMessageBox(focusedWindow || BrowserWindow.getAllWindows()[0], {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'The update will be downloaded in the background. You will be notified when it\'s ready to install.',
      buttons: ['OK']
    });
  }

  private showUpdateReadyDialog(info: any) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    dialog.showMessageBox(focusedWindow || BrowserWindow.getAllWindows()[0], {
      type: 'info',
      title: 'Update Ready',
      message: `Update ${info.version} has been downloaded and is ready to install.`,
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Restart Now"
        autoUpdater.quitAndInstall();
      }
    });
  }

  // Manual check for updates (can be called from menu)
  public checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Get current version
  public getCurrentVersion(): string {
    return autoUpdater.currentVersion?.version || '1.0.0';
  }
}