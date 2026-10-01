import type { ForgeConfig } from '@electron-forge/shared-types'

import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

import packageJson from './package.json'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'icon',
    // Used by the tray icon (see src/kernel/startup/system-tray.ts).
    extraResource: ['icon.ico'],
    // File details shown in Windows (Properties, Details).
    appCopyright: `Copyright (C) ${new Date().getFullYear()} ${packageJson.author.name}`,
    win32metadata: {
      CompanyName: packageJson.author.name,
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // Local file so "Installed apps" shows the current logo.
      iconUrl: pathToFileURL(path.resolve(__dirname, 'icon.ico')).href,
      setupIcon: 'icon.ico',
      // Shown while installing (replaces Squirrel's default green box).
      loadingGif: path.resolve(__dirname, 'installer-loading.gif'),
      // Named after the GitHub release ("releaseVersion", e.g. 1.0.1). The
      // package.json "version" only keeps Windows updates working (Squirrel
      // needs it to go up with every build).
      setupExe: `Mystic Launcher Setup ${packageJson.releaseVersion}.exe`,
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/kernel/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/kernel/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        draft: true,
        generateReleaseNotes: true,
        prerelease: false,
        repository: {
          owner: packageJson.author.name,
          name: packageJson.name,
        },
      },
    },
  ],
}

export default config
