# JupyterLab extension for SoS workflow engine and polyglot notebook

## Progress

Already Working:
* 03/20/2018 SoS file type (`.sos`) and syntax highlighting (edit a `.sos` file in JupyterLab)
* 04/03/2018 SoS Notebook UIs. SoS Notebooks can be properly displayed with notebook and cell level language selector
* 04/04/2018 Events, namely effects of language dropdown and frontend message.

Working on:
* Magics

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

