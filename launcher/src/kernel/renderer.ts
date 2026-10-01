/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import '@mantine/core/styles.css'
import '../globals.css'

function showStartupError(message: string) {
	const appRoot = document.getElementById('app')

	if (!appRoot) {
		return
	}

	appRoot.innerHTML = `
		<div style="
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			background: #0f172a;
			color: #e2e8f0;
			font-family: Segoe UI, Arial, sans-serif;
		">
			<div style="max-width: 900px; width: 100%; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 20px;">
				<h2 style="margin: 0 0 12px 0; font-size: 20px;">Mystic Launcher failed to start</h2>
				<p style="margin: 0 0 12px 0; color: #93c5fd;">An error occurred while loading the renderer.</p>
				<pre style="white-space: pre-wrap; word-break: break-word; background: #030712; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin: 0; color: #fca5a5;">${message}</pre>
			</div>
		</div>
	`
}

window.addEventListener('error', (event) => {
	const details = event.error?.stack || event.message || 'Unknown error'
	showStartupError(details)
})

window.addEventListener('unhandledrejection', (event) => {
	const reason = event.reason
	const details =
		typeof reason === 'string'
			? reason
			: reason?.stack || JSON.stringify(reason)

	showStartupError(details || 'Unhandled promise rejection')
})

void import('../app').catch((error: unknown) => {
	const details =
		typeof error === 'string'
			? error
			: (error as Error)?.stack || JSON.stringify(error)

	showStartupError(details || 'Failed to initialize app bootstrap')
})
