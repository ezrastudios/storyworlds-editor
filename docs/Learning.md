# Learning Log

This file tracks concepts learned while building Story Worlds Editor.

The goal is not only to build the tool, but to understand how it works.

## Format

Each entry should include:

- Date
- Concept
- What it means
- Where it appears in the project

## Entries

### Scene

A scene in Three.js is the container for everything visible in the 3D world.

If an object is not added to the scene, it exists in code but will not be rendered.

### Camera

A camera defines the point of view.

Moving the camera changes how we see the world without changing the world itself.

### Mesh

A mesh combines geometry and material.

- Geometry = shape
- Material = appearance

Example: a terrain plane is a mesh.

### Renderer

The renderer draws the scene from the camera's point of view into the browser.

### Raycasting

Raycasting lets the app detect where the user touched or clicked in the 3D world.

This will be important for painting terrain, selecting places and placing markers.
