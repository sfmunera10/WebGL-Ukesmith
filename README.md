# WebGL-Ukesmith

![View](https://user-images.githubusercontent.com/20799440/70561358-48c28100-1b58-11ea-9547-a66276162327.png)

3D game inspired by Rocksmith: https://rocksmith.ubisoft.com/rocksmith/en-us/home/, but this time is for Ukelele. The purpose of this project is to show off some of the features that the WebGL graphics library can offer for 3D game applications. The structure of this web project is forked from another repository (https://github.com/sbauersfeld/WebGL-VideoGame) that consists of a 3D platforming game that is also built using WebGL. 

## How to Run and Play

1. git clone this repository.
2. Run the local server: ./host.command (for Mac) or ./host.bat (for Windows)
3. Go to localhost:8000 in your favorite browser.
4. You can check out the game controls that appear below the canvas upon web initialization.
5. To start playing, press Space. Bars will automatically appear in a random fret/string position. When a bar hits a fretboard circle, it will produce a sound that corresponds to a specific note in that fret/string position. To pause the game, press P. To restart the game, you need to pause it and then press R.

## Important JS Files

* **main-scene.js** - Creates the game scene, geometry drawings (Ukelele.obj model, bars, fret and cubemap), bar generation using a matrix transform list, lightning configuration, audio configuration for each note and materials for each geometry (a material contains a shader, a texture and a color).
* **dependencies.js** - Creates specific geometries and Shaders for the shapes we need for the game, such as Cubes, Squares, Spheres, Circles, Basic Shaders, Phong Shaders and a handy .obj file parser that allows the rendering of .obj files in the WebGL context.
* **tiny-graphics** - library file that works in a low abstraction level fashion, using the WebGLContext to create generic Shaders, vertices, normals, texels, vectors, colors, matrices and its operations. It clearly works as a WebGLUtils library and was forked from the aforementioned repo: https://github.com/sbauersfeld/WebGL-VideoGame

## Features

* **OBJ Loader** - Used to load shapes for the Ukelele.

* **Random bar generation** bars are generated randomly to hit a specific note in the fretboard. 

* **Transparency, lightning and textures in materials** cubemap, bars, frets and ukelele.obj have transparency, lightning and texture effects on their materials.  

* **Music & Sound Effects** - Sound effects for ukelele notes (22 different notes, 12 notes for each string in one fret).
