// true while the app was started by the installer (install/update/uninstall).
declare module 'electron-squirrel-startup' {
  const started: boolean
  export default started
}
