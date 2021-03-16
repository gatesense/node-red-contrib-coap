module.exports = function (RED) {
    "use strict";
    var coap = require("coap");

    // A node red node that sets up a local coap server
    function CoapServerNode(n) {
        // Create a RED node
        RED.nodes.createNode(this, n);
        var node = this;

        // Store local copies of the node configuration (as defined in the .html)
        node.options = {};
        node.options.name = n.name;
        node.options.port = n.port;
        node.options.ipv6 = n.ipv6;
        node.options.wellknowncore = n.wellknowncore;

        node._inputNodes = []; // collection of "coap in" nodes that represent coap resources
        node._resourceList = []; // resource list for /.well-known/core

        // Setup node-coap server and start
        var serverSettings = {};
        if (node.options.ipv6) {
            serverSettings.type = "udp6";
        } else {
            serverSettings.type = "udp4";
        }
        node.server = new coap.createServer(serverSettings);
        node.server.on("request", function (req, res) {
            node.handleRequest(req, res);
            res.on("error", function (err) {
                node.log("server error");
                node.log(err);
            });
        });
        node.server.listen(node.options.port, function () {
            node.log("CoAP Server Started");
        });

        node.on("close", function () {
            node._inputNodes = [];
            node.server.close();
        });
    }
    RED.nodes.registerType("coap-server", CoapServerNode);

    CoapServerNode.prototype.registerInputNode = function (/*Node*/ resource) {
        var urlExists = false;
        var methodExists = false;
        var newNodeOptions = resource.options;

        if (newNodeOptions.url == "/.well-known/core" && this.options.wellknowncore) {
            this.error("Nodes can't have the URL /.well-known/core if it is enabled on the server!");
        }

        for (var i = 0; i < this._inputNodes.length; i++) {
            var existingNodeOptions = this._inputNodes[i].options;
            
            if (existingNodeOptions.url == newNodeOptions.url) {
                urlExists = true;
                if (existingNodeOptions.method == newNodeOptions.method) {
                    methodExists = true;
    
                    //TODO: Does this have any effect? Should show the error in the frontend somehow? Some kind of status bar?
                    this.error("Node with the specified URL and Method already exists!");
                }
            }
        }
        if (!urlExists) {
            if (this.options.wellknowncore) {
                this._resourceList.push(newNodeOptions.url);
            }
            if (!methodExists) {
                this._inputNodes.push(resource);
            }
        }
    };

    CoapServerNode.prototype._handleWellKnownCore = function (res) {
        // TODO: Expand capabilities of the handler for /.well-known/core
        var formattedResources = this._resourceList.map(function (resource) {
            return `<${resource}>`;
        })
        var payload = formattedResources.join(",");
        res.code = "2.05";
        res.setOption("Content-Format", "application/link-format");
        return res.end(payload);
    }

    CoapServerNode.prototype.handleRequest = function (req, res) {
        if (this.options.wellknowncore && req.url == "/.well-known/core" && req.method == "GET") {
            return this._handleWellKnownCore(res);
        }

        var matchResource = false;
        var matchMethod = false;
        for (var i = 0; i < this._inputNodes.length; i++) {
            if (this._inputNodes[i].options.url == req.url) {
                matchResource = true;
                if (this._inputNodes[i].options.method == req.method) {
                    matchMethod = true;
                    var inNode = this._inputNodes[i];
                    inNode.send({ req: req, res: res });
                }
            }
        }
        if (!matchResource) {
            res.code = "4.04";
            return res.end();
        }

        if (!matchMethod) {
            res.code = "4.05";
            return res.end();
        }
    };

    function CoapInNode(n) {
        RED.nodes.createNode(this, n);

        //copy "coap in" node configuration locally
        this.options = {};
        this.options.method = n.method;
        this.options.name = n.name;
        this.options.server = n.server;
        this.options.url = n.url.charAt(0) == "/" ? n.url : "/" + n.url;

        this.serverConfig = RED.nodes.getNode(this.options.server);

        if (this.serverConfig) {
            this.serverConfig.registerInputNode(this);
        } else {
            this.error("Missing server configuration");
        }
    }
    RED.nodes.registerType("coap in", CoapInNode);
};
