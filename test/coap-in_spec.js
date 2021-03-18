var should = require("should");

var coap = require("coap");
var url = require("url");
var coapInNode = require("../coap/coap-in.js");
var functionNode = require("@node-red/nodes/core/function/10-function.js");
var helper = require("node-red-node-test-helper");

describe("CoapInNode", function () {
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(function () {
            helper.stopServer(done);
        });
    });

    it("should be loaded", function (done) {
        var flow = [
            {
                id: "coapServer1",
                type: "coap-server",
                name: "coapServer",
                port: 5683,
            },
            {
                id: "coapIn1",
                type: "coap in",
                method: "GET",
                name: "coapIn",
                url: "/test",
                server: "coapServer1",
            },
            {
                id: "coapIn2",
                type: "coap in",
                method: "GET",
                name: "coapIn",
                url: "test2",
                server: "coapServer1",
            },
        ];

        //need to register nodes in order to use them
        var testNodes = [coapInNode];
        helper.load(testNodes, flow, function () {
            var coapIn1 = helper.getNode("coapIn1");
            coapIn1.options.should.have.property("method", "GET");
            coapIn1.options.should.have.property("name", "coapIn");
            coapIn1.options.should.have.property("url", "/test");
            coapIn1.options.should.have.property("server");

            var coapIn2 = helper.getNode("coapIn2");
            coapIn2.options.should.have.property("url", "/test2");
            done();
        });
    });

    it("should return 4.04 for unregistered paths", function (done) {
        var flow = [
            {
                id: "n1",
                type: "coap-server",
                name: "coapServer",
                port: 8888,
            },
        ];

        // Need to register nodes in order to use them
        helper.load(coapInNode, flow, function () {
            var urlStr = "coap://localhost:8888/unregistered";
            var opts = url.parse(urlStr);
            opts.method = "GET";
            var req = coap.request(opts);

            req.on("response", function (res) {
                res.code.should.equal("4.04");
                done();
            });
            req.end();
        });
    });

    describe("Methods", function () {
        var methodTests = [
            { method: "GET", message: "You get me, buddy" },
            { method: "PUT", message: "This resource sucks–need to change it" },
            { method: "POST", message: "Welcome aboard!" },
            { method: "DELETE", message: "Erase and rewind…" },
        ];

        var protocols = ["ipv4", "ipv6"];

        for (var i = 0; i < protocols.length; i++) {
            var protocol = protocols[i];

            for (j = 0; j < methodTests.length; ++j) {
                (function (test) {
                    var serverAddress = "localhost";
                    var ipv6Enabled = false;

                    if (protocol == "ipv6") {
                        serverAddress = "[::1]";
                        ipv6Enabled = true;
                    }

                    it(
                        "should accept " +
                        test.method +
                        " requests over " +
                        protocol,
                        function (done) {
                            var flow = [
                                {
                                    id: "n1",
                                    type: "coap-server",
                                    name: "coapServer",
                                    port: 8888,
                                    ipv6: ipv6Enabled,
                                },
                                {
                                    id: "n2",
                                    type: "coap in",
                                    method: test.method,
                                    name: "coapIn",
                                    url: "/test",
                                    server: "n1",
                                    wires: [["n3"]],
                                },
                                {
                                    id: "n3",
                                    type: "function",
                                    name: "setPayload",
                                    func:
                                        "msg.payload = '" +
                                        test.message +
                                        "';\nreturn msg;",
                                    wires: [["n4"]],
                                },
                                {
                                    id: "n4",
                                    type: "coap response",
                                    name: "coapOutGet",
                                    statusCode: "",
                                    wires: [],
                                },
                            ];

                            // Need to register nodes in order to use them
                            var testNodes = [functionNode, coapInNode];
                            helper.load(testNodes, flow, function () {
                                var urlStr =
                                    "coap://" + serverAddress + ":8888/test";
                                var opts = url.parse(urlStr);
                                opts.method = test.method;
                                var req = coap.request(opts);

                                req.on("response", function (res) {
                                    res.payload
                                        .toString()
                                        .should.equal(test.message);
                                    done();
                                });
                                req.end();
                            });
                        }
                    );
                })(methodTests[j]);
            }
        }

        it("should return 4.05 for unregistered methods", function (done) {
            var flow = [
                {
                    id: "n1",
                    type: "coap-server",
                    name: "coapServer",
                    port: 8888,
                },
                {
                    id: "n2",
                    type: "coap in",
                    method: "GET",
                    name: "coapIn",
                    url: "/test",
                    server: "n1",
                },
            ];

            // Need to register nodes in order to use them
            var testNodes = [coapInNode];
            helper.load(testNodes, flow, function () {
                var urlStr = "coap://localhost:8888/test";
                var opts = url.parse(urlStr);
                opts.method = "PUT";
                var req = coap.request(opts);

                req.on("response", function (res) {
                    res.code.should.equal("4.05");
                    done();
                });
                req.end();
            });
        });
    });
});
