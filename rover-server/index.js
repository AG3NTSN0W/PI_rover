//  start stream: 
// cd ~/workspace/mjpg/mjpg-streamer/mjpg-streamer-experimental
// export LD_LIBRARY_PATH=.
// ./mjpg_streamer -o "output_http.so -w ./www -p 9000" -i "input_raspicam.so -fps 15 -q 50 -x 1280 -y 720 -rot 180"


// ffmpeg -f v4l2 -framerate 20 -video_size 640x480  -i /dev/video0 -vf "rotate=180*(PI/180)" -f mpegts -codec:v mpeg1video -s 640x480 -b:v 1000k -bf 0 http://localhost:8865/secret


"use strict";

var i2cBus = require("i2c-bus");
var Pca9685Driver = require("pca9685").Pca9685Driver;

var WebSocketServer = require('websocket').server;
var http = require('http');

var WebSocket = require('ws');

// PCA9685 options
const options = {
    i2c: i2cBus.openSync(1),
    address: 0x40,
    frequency: 50,
    debug: false
};

// Servo Config
const xAxisChannel = 0;
const yAxisChannel = 1;

const xStartPosition = 2200;
const yStartPosition = 1425
const positionChange = 15;

const xMinPosition = 1930;
const xMaxPosition = 2485;

const yMinPosition = 1590;
const yMaxPosition = 750;

var xCurrentPosition = xStartPosition;
var yCurrentPosition = yStartPosition;

var pwm;

// Websocket config.
const SERVER_PORT = 8765;

const WEBSOCKET_PORT = 8860;
const STREAM_PORT = 8865;
const STREAM_SECRET = process.env.SECRET || 'secret'

function startPosition() {
    pwm.setPulseLength(xAxisChannel, xStartPosition);
    pwm.setPulseLength(yAxisChannel, yStartPosition);
}

function maxPosition() {

    if (yCurrentPosition >= yMinPosition) {
        yCurrentPosition = yMinPosition
    } else if (yCurrentPosition <= yMaxPosition) {
        yCurrentPosition = yMaxPosition
    }

    if (xCurrentPosition >= xMaxPosition) {
        xCurrentPosition = xMaxPosition
    } else if (xCurrentPosition <= xMinPosition) {
        xCurrentPosition = xMinPosition
    }

}

function setPosition() {
    maxPosition()
    pwm.setPulseLength(xAxisChannel, xCurrentPosition);
    pwm.setPulseLength(yAxisChannel, yCurrentPosition);
}

function onMessage(message) {
    switch (message) {
        case '"ArrowRight"':
            xCurrentPosition += positionChange;
            break;
        case '"ArrowLeft"':
            xCurrentPosition -= positionChange;
            break;
        case '"ArrowUp"':
            yCurrentPosition -= positionChange;
            break;
        case '"ArrowDown"':
            yCurrentPosition += positionChange;
            break;
        default:
            console.warn("default", message)
    }
    console.log(message)
    setPosition()
}

// initialize PCA9685 and start loop once initialized
pwm = new Pca9685Driver(options, function startLoop(err) {
    if (err) {
        console.error("Error initializing PCA9685");
        process.exit(-1);
    }

    startPosition()
});

var server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(SERVER_PORT, function () {
    console.log((new Date()), ' Server is listening on port: ', SERVER_PORT);
});

var wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true,
});

wsServer.on('connect', function (request) {
    console.log((new Date()) + ' Peer connected.');
    request.sendUTF(JSON.stringify({ "x": xCurrentPosition, 'y': yCurrentPosition }));

    request.on('message', function (message) {
        if (message.type === 'utf8') {
            const webMessage = message.utf8Data;
            onMessage(webMessage)

            var messageToSend = JSON.stringify({ "x": xCurrentPosition, 'y': yCurrentPosition })
            request.sendUTF(messageToSend);

        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            request.sendBytes(message.binaryData);
        } else {
            console.log('Received Binary Message of ' + message);
        }
    });

});


wsServer.on('close', function (reasonCode, description) {
    console.log((new Date()) + ' Peer disconnected.');
});

var socketServer = new WebSocket.Server({
    port: WEBSOCKET_PORT, 
    perMessageDeflate: false,
    cors: {
        origin: '*',
    }
});

socketServer.connectionCount = 0;
socketServer.on('connection', function (socket, upgradeReq) {
    socketServer.connectionCount++;
    console.log(
        'New WebSocket Connection: ',
        (upgradeReq || socket.upgradeReq).socket.remoteAddress,
        (upgradeReq || socket.upgradeReq).headers['user-agent'],
        '(' + socketServer.connectionCount + ' total)'
    );
    socket.on('close', function (code, message) {
        socketServer.connectionCount--;
        console.log(
            'Disconnected WebSocket (' + socketServer.connectionCount + ' total)'
        );
    });
});

socketServer.broadcast = function (data) {
    socketServer.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

var streamServer = http.createServer(function (request, response) {
    var params = request.url.substr(1).split('/');

    if (params[0] !== STREAM_SECRET) {
        console.log(
            'Failed Stream Connection: ' + request.socket.remoteAddress + ':' +
            request.socket.remotePort + ' - wrong secret.'
        );
        response.end();
    }

    response.connection.setTimeout(0);
    console.log(
        'Stream Connected: ' +
        request.socket.remoteAddress + ':' +
        request.socket.remotePort
    );
    request.on('data', function (data) {
        socketServer.broadcast(data);
    });
    request.on('end', function (e) {
        console.log('close', e);
    });
})

// Keep the socket open for streaming
streamServer.headersTimeout = 0;
streamServer.listen(STREAM_PORT, function () {
    console.log((new Date()), ' MPEG-TS Stream listening on port: ', STREAM_PORT);
});

// set-up CTRL-C with graceful shutdown
process.on("SIGINT", function () {
    console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");

    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    pwm.dispose();
    wsServer.unmount()
});