module.exports = function (RED) {
    "use strict";

    var coap = require("coap");
    var cbor = require("cbor");
    var url = require("uri-js");
    var linkFormat = require("h5.linkformat");

    coap.registerFormat("application/cbor", 60);

    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        // copy "coap request" configuration locally
        node.options = {};
        node.options.method = n.method;
        node.options.observe = n.observe;
        node.options.name = n.name;
        node.options.url = n.url;
        node.options.contentFormat = n["content-format"];
        node.options.rawBuffer = n["raw-buffer"];
        node.options.multicast = n.multicast;

        function _constructPayload(msg, contentFormat) {
            var payload = null;

            if (!msg.payload) {
                return null;
            }
            else if (contentFormat === "text/plain") {
                payload = msg.payload.toString();
            } else if (contentFormat === "application/json") {
                payload = JSON.stringify(msg.payload);
            } else if (contentFormat === "application/cbor") {
                payload = cbor.encode(msg.payload);
            }

            return payload;
        }

        function _makeRequest(msg) {
            var reqOpts = url.parse(node.options.url || msg.url);
            reqOpts.pathname = reqOpts.path;
            reqOpts.method = (
                node.options.method ||
                msg.method ||
                "GET"
            ).toUpperCase();
            reqOpts.headers = {};
            reqOpts.headers["Content-Format"] = node.options.contentFormat;
            reqOpts.multicast = node.options.multicast;
            reqOpts.multicastTimeout = node.options.multicastTimeout;

            function _onResponse(res) {
                function _send(payload) {
                    if (!node.options.observe) {
                        node.status({});
                    }
                    node.send(
                        Object.assign({}, msg, {
                            payload: payload,
                            headers: res.headers,
                            statusCode: res.code,
                        })
                    );
                }

                function _onResponseData(data) {

                    var contentFormat = res.headers["Content-Format"];

                    if (node.options.rawBuffer) {
                        _send(data);
                    } else if (contentFormat === "text/plain") {
                        _send(data.toString());
                    } else if (contentFormat === "application/json") {
                        try {
                            _send(JSON.parse(data.toString()));   
                        } catch (error) {
                            node.status({fill:"red", shape:"ring", text:error.message});
                            node.error(error.message);
                        }
                    } else if (contentFormat === "application/cbor") {
                        cbor.decodeAll(data, function (error, data) {
                            if (error) {
                                node.error(error.message);
                                node.status({fill:"red", shape:"ring", text:error.message});
                                return false;
                            }
                            _send(data[0]);
                        });
                    } else if (contentFormat === "application/link-format") {
                        _send(linkFormat.parse(data.toString()));
                    } else {
                        _send(data.toString());
                    }
                }

                res.on("data", _onResponseData);

                if (reqOpts.observe) {
                    node.status({fill:"blue",shape:"dot",text:"coapRequest.status.observing"});
                    node.stream = res;
                }
            }

            var payload = _constructPayload(msg, node.options.contentFormat);

            if (node.options.observe) {
                reqOpts.observe = "1";
            } else {
                delete reqOpts.observe;
            }

            // TODO: should revisit this block
            if (node.stream) {
                node.stream.close();
            }

            var req = coap.request(reqOpts);
            req.on("response", _onResponse);
            req.on("error", function (error) {
                node.status({fill:"red", shape:"ring", text:error.message});
                node.log("client error");
                node.log(error.message);
            });

            if (payload) {
                req.write(payload);
            }
            req.end();
        }

        this.on("input", function (msg) {
            node.status({fill:"blue",shape:"dot",text:"coapRequest.status.requesting"});
            _makeRequest(msg);
        });

        this.on("close",function() {
            node.status({});
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};
