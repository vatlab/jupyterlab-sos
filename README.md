[![Build Status](https://travis-ci.org/vatlab/jupyterlab-sos.svg?branch=master)](https://travis-ci.org/vatlab/jupyterlab-sos)
[![npm version](https://badge.fury.io/js/jupyterlab-sos.svg)](https://badge.fury.io/js/jupyterlab-sos)
[![PyPI version](https://badge.fury.io/py/jupyterlab-sos.svg)](https://badge.fury.io/py/jupyterlab-sos)


# JupyterLab extension for SoS polyglot notebook and workflow system

jupyterlab-sos is a JupyterLab extension for the [SoS Polyglot Notebook](https://vatlab.github.io/sos-docs/) that allows you to use multiple Jupyter kernels in one notebook. It is also a frontend to the [SoS Workflow Engine](https://github.com/vatlab/SoS) that is designed for daily computational research with both exploratory interactive data analysis and batch data processing.

## Prerequisites

* [sos-notebook](https://github.com/vatlab/sos-notebook) and language modules of interest (e.g. [sos-python](https://github.com/vatlab/sos-python) and [sos-r](https://github.com/vatlab/sos-notebook)). See [installation instruction](https://vatlab.github.io/sos-docs/running.html) for details.
* JupyterLab >= 1.0.0
* [transient-display-data](https://github.com/vatlab/transient-display-data)

## Installation

* If you are using conda, you can install `jupyterlab-sos` with command

  ```bash
  conda install jupyterlab-sos -c conda-forge
  ```
  This will automatically install the `transient-display-data` extension, even `jupyterlab`, `sos-notebook`, and `sos` if needed.

* If you have a working jupyterlab installation with `sos-notebook`, you can install `jupyterlab-sos` from command line

  ```bash
  pip install jupyterlab-sos
  ```

  or through the jupyterlab extension installation process,
  which will require node.js

  ```bash
  jupyter labextension install transient-display-data
  jupyter labextension install jupyterlab-sos
  ```

  You could also install these two extensions from the extension manager (`Enable Extension Manager` from `Settings` if needed).

  Finally, if you just upgraded `jupyterlab` with `jupyterlab-sos` installed, you could run

  ```bash
  jupyter labextension update --all
  ```

  to upgrade all your extensions to the latest version.

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
