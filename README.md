node-red-contrib-coap
=====================
![Build Status](https://github.com/JKRhb/node-red-contrib-coap/workflows/Build%20Status/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/JKRhb/node-red-contrib-coap/badge.svg?branch=master)](https://coveralls.io/github/JKRhb/node-red-contrib-coap?branch=master)
[![Dependency Status](https://david-dm.org/JKRhb/node-red-contrib-coap.png)](https://david-dm.org/JKRhb/node-red-contrib-coap)
[![Dev Dependency Status](https://david-dm.org/JKRhb/node-red-contrib-coap/dev-status.png)](https://david-dm.org/JKRhb/node-red-contrib-coap#dev-badge-embed)

This project adds CoAP support to [Node-RED](http://nodered.org/). It is based on Matteo Collina's [node-coap](https://github.com/mcollina/node-coap).

Functionality
-------------
 We introduce "coap request", "coap in", and "coap response" nodes which can be used in a similar fashion to "http request", "http in", and "http reponse" nodes from Node-RED's core.

Install
-------

```bash
cd $NODE_RED_HOME
npm install node-red-contrib-coap
```

Install from Source
-------------------

```bash
cd $NODE_RED_HOME/nodes
git clone https://github.com/JKRhb/node-red-contrib-coap.git
cd ./node-red-contrib-coap
npm install
```

Examples
--------
You can check out a couple of usage examples at *./examples* directory of this repo.
