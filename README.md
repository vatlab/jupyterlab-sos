# JupyterLab extension for SoS polyglot notebook and workflow system

jupyterlab-sos is a JupyterLab extension for the [SoS Polyglot Notebook](https://vatlab.github.io/sos-docs/) that allows you to use multiple Jupyter kernels in one notebook. It is also a frontend to the [SoS Workflow Engine](https://github.com/vatlab/SoS) that is designed for daily computational research with both exploratory interactive data analysis and batch data processing.

## Prerequisites

* JupyterLab >= 1.0.0
* [transient-display-data](https://github.com/vatlab/transient-display-data)

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

