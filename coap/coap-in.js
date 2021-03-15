module.exports = function (RED) {
    "use strict";
    var coap = require("coap");
    var cbor = require("cbor");

    coap.registerFormat("application/cbor", 60);

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

        node._inputNodes = []; // collection of "coap in" nodes that represent coap resources

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
            //console.log('server started');
            node.log("CoAP Server Started");
        });

        node.on("close", function () {
            node._inputNodes = [];
            node.server.close();
        });
    }
    RED.nodes.registerType("coap-server", CoapServerNode);

    CoapServerNode.prototype.registerInputNode = function (/*Node*/ resource) {
        var exists = false;
        for (var i = 0; i < this._inputNodes.length; i++) {
            if (
                this._inputNodes[i].options.url == resource.options.url &&
                this._inputNodes[i].options.method == resource.options.method 
                // &&
                // this._inputNodes[i].options.contentFormat == resource.options.contentFormat
            ) {
                exists = true;

                //TODO: Does this have any effect? Should show the error in the frontend somehow? Some kind of status bar?
                this.error(
                    "Node with the specified URL and Method already exists!"
                );
            }
        }
        if (!exists) {
            this._inputNodes.push(resource);
        }
    };

    function _onRequest(inNode, req, res) {
        var acceptedContentFormat = req.headers["Content-Format"];

        function _send(payload) {
            var contentFormat = req.headers["Content-Format"];
            inNode.send({
                payload: payload,
                contentFormat: contentFormat,
                req: req,
                res: res,
            });
        }

        if (inNode.options.rawBuffer) {
            _send(req.payload);
        } else if (req.headers["Content-Format"] === "text/plain") {
            _send(req.payload.toString());
        } else if (req.headers["Content-Format"] === "application/json") {
            _send(JSON.parse(req.payload.toString()));
        } else if (req.headers["Content-Format"] === "application/cbor") {
            cbor.decodeAll(req.payload, function (err, payload) {
                if (err) {
                    return false;
                }
                _send(payload[0]);
            });
        } else if (
            req.headers["Content-Format"] === "application/link-format"
        ) {
            _send(linkFormat.parse(req.payload.toString()));
        } else {
            _send(req.payload.toString());
        }
    }

    CoapServerNode.prototype.handleRequest = function (req, res) {
        //TODO: Check if there are any matching resource. If the resource is .well-known return the resource directory to the client
        var matchResource = false;
        var matchMethod = false;
        for (var i = 0; i < this._inputNodes.length; i++) {
            if (this._inputNodes[i].options.url == req.url) {
                matchResource = true;
                if (this._inputNodes[i].options.method == req.method) {
                    matchMethod = true;
                    var inNode = this._inputNodes[i];
                    _onRequest(inNode, req, res);
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

    function CoapOutNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        node.options = {};
        node.options.name = n.name;
        node.options.code = n.code;

        function _constructPayload(msg, contentFormat) {
            var payload = null;

            if (contentFormat === "text/plain") {
                payload = String(msg.payload);
            } else if (contentFormat === "application/json") {
                payload = JSON.stringify(msg.payload);
            } else if (contentFormat === "application/cbor") {
                payload = cbor.encode(msg.payload);
            } else if (msg.payload) {
                payload = msg.payload.toString();
            }

            return payload;
        }

        function _determineStatusCode(options, msg) {
            if (options.code) {
                return options.code;
            } else if (msg.statusCode) {
                return msg.statusCode;
            } else {
                return "2.05";
            }
        }

        this.on("input", function (msg, _send, done) {
            var code = _determineStatusCode(node.options, msg);
            var contentFormat = msg.contentFormat || node.options.contentFormat;
            var payload = _constructPayload(msg, contentFormat);

            if (msg.res) {
                msg.res.code = code;
                if (contentFormat) {
                    msg.res.setOption("Content-Format", contentFormat);
                }

                msg.res.on("error", function (err) {
                    node.log("server error");
                    node.log(err);
                });

                if (payload) {
                    msg.res.write(payload);
                }

                msg.res.end();
            } else {
                node.error("No response found in input node!");
            }

            done();
        });
    }
    RED.nodes.registerType("coap response", CoapOutNode);
};
