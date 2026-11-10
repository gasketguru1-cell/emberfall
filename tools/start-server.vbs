' Starts the Emberfall game server with no window, so http://localhost:8317 works.
' A shortcut to this file sits in the Windows Startup folder, so it runs at every sign-in.
' To stop it starting with Windows, delete that shortcut ("Emberfall game server").
' If a copy is already running, the new one just stands by (see serve.js).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.Run "node serve.js", 0, False
