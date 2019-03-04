# JupyterLab extension for SoS workflow engine and polyglot notebook

## Status

This extension currently builds upon JupyterLab 1.0.0 alpha, and will evolve as the 
JupyterLab API continues to evolve. It is currently feature complete except for sending
codes from subkernels directly to console window, which depends on a 
[PR](https://github.com/jupyterlab/jupyterlab/pull/6063) that is still under review.

## Prerequisites

* JupyterLab 1.0.0 alpha
* transient-display-data

## Installation

```bash
jupyter labextension install transient-display-data
jupyter labextension install jupyterlab-sos
```
or install these two extensions from the extension manager.

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

