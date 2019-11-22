require("./modules/logging.js");

const serialport = require('serialport');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");

app.use("/", express.static('./public'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(8080, () => {
  //screen_ready();
  debug("API READY");
});

var OPEN_PORTS = {};

function getAllPorts() {
  return new Promise(async (resolve, reject) => {
    var allPorts = await serialport.list();
    return resolve(allPorts.map((port) => { return getPortState(port.path.replace("/dev/","")); }));
  });
}

function getPortState(_name) {
  var openPort = OPEN_PORTS[_name];
  return {
    port: _name,
    open: !!openPort,
    baud: openPort ? openPort.baud : 0,
    bytesReceived: openPort ? openPort.receiveBuffer.length : 0
  };
}

function openPort(_name, _baud) {
  try {
    //Check for existing
    var existing = OPEN_PORTS[_name];
    if (existing) {
      //Close first, then reopen
      existing.close();
    }
    //Open port
    var port = new serialport("/dev/" + _name, {
      baudRate: _baud
    });
    //Init event listeners
    port.on('open', onPortOpen);
    port.on('close', onPortClose);
    port.on('data', onPortReceive);
    return true;
  } catch(e) {
    error("Failed to open port " + _name + " @ " + _baud + " e: " + e);
    return false;
  }
}

function onPortOpen(){
  //Port has been opened on the I/O level
  OPEN_PORTS[this.path.replace("/dev/","")] = this;
  this.receiveBuffer = [];
  info("Port " + this.path + " opened @ " + this.baudRate + " baud");
}

function onPortClose(){
  //Port has been closed on the I/O level, remove from OPEN_PORTS
  delete OPEN_PORTS[this.path.replace("/dev/","")];
  info("Port " + this.path + " closed");
}

function onPortReceive(_data) {
  //Port has received data on the I/O level
  info("Port " + this.path + " received " + _data.length + " bytes");
  this.receiveBuffer.push.apply(this.receiveBuffer, _data);
}


// API METHODS /////////////////////////////////////////////////////////////////

app.get("/ports", async (_req, _res) => {
  // Get ports
  var ports = await serialport.list();
   _res.send((await getAllPorts()))
});

app.post("/ports/:port", async (_req, _res) => {
  // Open Port or write data
  if (_req.body && Object.keys(_req.body).length > 0) {
    //Write data to port
    var port = OPEN_PORTS[_req.params.port];
    if (port && port.open) {
      port.write(_req.body.string);
      _res.status(200).send(JSON.stringify({ success: true }));
    } else {
      _res.status(500).send(JSON.stringify({
        success: false,
        error: "Port not open"
      }));
    }
  } else {
    //Open port
    var port = openPort(_req.params.port, parseInt(_req.query.baud) || 9600);
    if (port) {
      _res.status(200).send();
    } else {
      _res.status(500).send();
    }
  }
});

app.get("/ports/:port", (_req, _res) => {
  // Get port state
  var port = OPEN_PORTS[_req.params.port];
  if (port) {
    _res.send(getPortState(port));
  } else {
    _res.status(500).send({});
  }
});


app.get("/ports/:port/receive", (_req, _res) => {
  // Get data stored in receive buffer, Params: clears
  var port = OPEN_PORTS[_req.params.port];
  if (port) {
    _res.status(200).send({
      data: port.receiveBuffer,
      length: port.receiveBuffer.length
    });
    if (_req.query.clear) { port.receiveBuffer = []; }
  } else {
    _res.status(500).send("{}");
  }
});


app.delete("/ports/:port", (_req, _res) => {
  // Close port
  var port = OPEN_PORTS[_req.params.port];
  if (port && port.open) {
    port.close();
    _res.send(true);
  } else {
    _res.status(500).send(false);
  }
});
