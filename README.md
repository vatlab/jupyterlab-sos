# sos-extension

JupyterLab extension for SoS workflow engine and polyglot notebook

## Progress

Already Working:
* SoS file type (`.sos`) and syntax highlighting (edit a `.sos` file in JupyterLab)

Working on:
* SoS Notebook UIs

## Prerequisites

* JupyterLab

## Installation

```bash
jupyter labextension install sos-extension
```

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

