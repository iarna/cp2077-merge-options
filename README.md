# Merge CP2077 Options for ModOrganizer 2

This is a tool for merging CP2077 options.json files. There are many mods
that include an options.json file, but CP2077 can only load one of them. 
With MO2 we have access to all of the source mods that will be used, which
gives us the opportunity to automatically resolve these conflicts.


## How To Use It

Extract the zip file into your MO2 folder. You should then have a tools
folder, with `merge-options.exe` in it.

Add the tool to MO2 -- its arguments are the MO2 folder and the name of the
mod you want to write the merged options to.  If you don't specify a mod
name, it will create one named "Merged Options" and save the file there.

![](mo2-executables.png)



## How It Works

It walks through the active mods in your current MO2 profile looking for these:

`r6/config/settings/platform/pc/options.json`

It reads each in turn -- it determines what a change is by comparing it to
the version found in your Cyberpunk install.

## Seeing the Changes

If you want to see what it found that was different than the stock options
file, there's a file written to MO2's logs folder named
`options-json-merger-changes.yaml` that's hopefully fairly self explanatory. 
(It's currently pretty good but not perfect at identifying and sourcing all
the changes. It'll improve over time.)

## Example options.json Mods

These are the mod's whose options.json's I merge in my own load order:

* [Unlock Hidden Settings and Slider Limits](https://www.nexusmods.com/cyberpunk2077/mods/13943)
* [Miscellaneous Settings Unlocker](https://www.nexusmods.com/cyberpunk2077/mods/8124)
* [No More Hard-Coded Keybinds](https://www.nexusmods.com/cyberpunk2077/mods/4008)
* [Immersive First Person - FreeLook (options.json)](https://www.nexusmods.com/cyberpunk2077/mods/2675)
* [Unlock Fov](https://www.nexusmods.com/cyberpunk2077/mods/7989)

## Source Code and License

This is MIT licensed, which basically means "do what you like, just don't
take credit for my work".  See the [LICENSE](LICENSE) file for the actual
legalize.

The repo is on github at: [github.com/iarna/cp2077-merge-options](https://github.com/iarna/cp2077-merge-options)

