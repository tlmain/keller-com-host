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

var PORTS = {};

//setInterval(updatePorts, 1000);

updatePorts();

async function updatePorts() {
  var allPorts = await serialport.list()
  allPorts.forEach((pInfo) => {
    var name = pInfo.path.replace("/dev/","");
    //Port init'd?
    var port = PORTS[name];
    if (port) {
      //Already init'd
    } else {
      //Requires init
      PORTS[name] = new serialport("/dev/" + name, { autoOpen: false });
      PORTS[name].receiveBuffer = [];
      PORTS[name] .on('open', onPortOpen);
      PORTS[name] .on('close', onPortClose);
      PORTS[name] .on('data', onPortReceive);
    }
  });
}

function getPortSummary(_port) {
  return {
    port: _port.path.replace("/dev/",""),
    open: _port ? _port.isOpen : false,
    baud: _port ? (_port.baud || 0) : 0,
    bytesReceived: _port ? _port.receiveBuffer.length : 0
  };
}

async function openPort(_name, _baud) {
  try {
    var port = PORTS[_name];
    //Already open?
    if (port.isOpen) {
      //Close first
      await closePort(_name);
    }
    port.open();
    return true;
  } catch(e) {
    error("Failed to open port " + _name + " @ " + _baud + " e: " + e);
    return false;
  }
}

function closePort(_name) {
  return new Promise((resolve, reject) => {
    var port = PORTS[_name];
    port.close();
    setInterval(() => {
      //Wait for close
      if (!port.isOpen) { return resolve(); }
    }, 100);
  });
}


function onPortOpen(){
  //Port has been opened on the I/O level
  this.receiveBuffer = []
  info("Port " + this.path + " opened @ " + this.baudRate + " baud, buffers cleared");
}

function onPortClose(){
  //Port has been closed on the I/O level
  this.receiveBuffer = []
  info("Port " + this.path + " closed, buffers cleared");
}

function onPortReceive(_data) {
  //Port has received data on the I/O level
  info("Port " + this.path + " received " + _data.length + " bytes");
  this.receiveBuffer.push.apply(this.receiveBuffer, _data);
}


// API METHODS /////////////////////////////////////////////////////////////////

app.get("/ports", async (_req, _res) => {
  // Get all ports
  var ports = await serialport.list();
   _res.send(Object.values(PORTS).map((port) => { return getPortSummary(port); }));
});

app.post("/ports/:port", async (_req, _res) => {
  // Open Port or write data
  if (_req.body && Object.keys(_req.body).length > 0) {
    //Write data to port
    var port = PORTS[_req.params.port];
    if (port && port.isOpen) {
      port.write(_req.body.string);
      _res.status(200).send();
    } else {
      _res.status(500).send();
    }
  } else {
    //Open port
    openPort(_req.params.port, parseInt(_req.query.baud) || 9600);
   _res.status(200).send();
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
