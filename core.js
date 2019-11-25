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
      PORTS[name].on('open', onPortOpen);
      PORTS[name].on('close', onPortClose);
      PORTS[name].on('data', onPortReceive);
    }
  });
}


function getPortSummary(_port) {
  return {
    name: _port.path.replace("/dev/",""),
    open: _port ? _port.isOpen : false,
    baud: _port ? (_port.baudRate || 0) : 0,
    bytesReceived: _port ? _port.receiveBuffer.length : 0
  };
}

function openPort(_name, _baud) {
  return new Promise(async (resolve, reject) => {
    try {
      var port = PORTS[_name];
      //Already open?
      if (port.isOpen) {
        //Close first
        await closePort(_name);
      }
      //Update settings
      port.open(() => {
        port.update({ baudRate: _baud }, () => {});
      });
      return resolve(true);
    } catch(e) {
      error("Failed to open port " + _name + " e: " + e);
      return resolve(false);
    }
  });
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
  info("Port " + this.path + " opened, buffers cleared");
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
  var summaries = {};
  Object.values(PORTS).forEach((port) => {
    summaries[port.path.replace("/dev/","")] = getPortSummary(port);
  });
   _res.send(summaries);
});

app.post("/ports/:port", async (_req, _res) => {
  // Open Port or write data
  if (_req.body && Object.keys(_req.body).length > 0) {
    //Write data to port
    var port = PORTS[_req.params.port];
    if (port && port.isOpen) {
      port.write(_req.body.string, (e) => {
        _res.status(e ? 500 : 200).send();
      });
    } else {
      error("Attempted to write to closed port " + _req.params.port)
      _res.status(500).send();
    }
  } else {
    //Open port
    var opened = await openPort(_req.params.port, parseInt(_req.query.baud) || 9600);
   _res.status(opened ? 200 : 500).send();
  }
});

app.get("/ports/:port", (_req, _res) => {
  // Get port state
  var port = PORTS[_req.params.port];
  if (port) {
    _res.status(200).send(getPortState(port));
  } else {
    _res.status(500).send({});
  }
});

app.get("/ports/:port/receive", (_req, _res) => {
  // Get data stored in receive buffer, Params: clears
  var port = PORTS[_req.params.port];
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
  var port = PORTS[_req.params.port];
  if (port && port.isOpen) {
    port.close();
    _res.status(200).send();
  } else {
    _res.status(500).send();
  }
});
