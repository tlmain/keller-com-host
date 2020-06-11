require("./modules/logging.js");

const serialport = require('serialport');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(8080, () => {
  //screen_ready();
  debug("API READY on 8080");
});

DEFAULT_BAUD = 115200;

CONFIG_PROPERTIES = ["baudRate","dataBits", "parity","xany", "xon", "xoff", "rtscts"];

PORTS = {};


// API METHODS /////////////////////////////////////////////////////////////////

app.get("/ports", async (_req, _res) => {
  // Get all ports
  var info = {};
  Object.values(PORTS).forEach((port) => {
    info[port.path] = getPortSummary(port);
  });
   _res.send(info);
});

app.get("/ports/:port", async (_req, _res) => {
  var port = PORTS[_req.params.port];
  if (port) { _res.send(getPortSummary(port)); } else { _res.status(500).send(); }
});

app.post("/ports/:port", async (_req, _res) => {
  var port = PORTS[_req.params.port];
  if (!port) {
    return _res.status(500).send();
  }

  //Build port configuration object (current unless specified in body)
  var configuration = {};
  CONFIG_PROPERTIES.forEach((prop) => {
    configuration[prop] = _req.body.hasOwnProperty(prop) ? _req.body[prop] : port.settings[prop];
  });

  //Clear received if requested
  if (Array.isArray(_req.body.received) && _req.body.received.length == 0) {
    port.received = [];
  }

  //Update settings
  port.update(configuration, () => {
    //Check for transmit data
    if (_req.body.transmit) {
      //Transmit the supplied data
      port.write(_req.body.transmit, (e) => {
        if (e) {
          //Error
          _res.status(500).send(e);
        } else {
          //Success, check for wait condition
          if (_req.body.waitForTime) {
            //Wait a static timeframe (ms) then respond
            setTimeout(() => { _res.send(getPortSummary(port)); }, _req.body.waitForTime);
          } else if (_req.body.waitForCount) {
            //Wait for receive buffer to reach a certain size (or timeout) then respond
            var timeout = 1000;
            var interval = setInterval(() => {
              if (port.received.length >= _req.body.waitForCount || timeout == 0) {
                clearInterval(interval);
                return _res.send(getPortSummary(port));
              }
              timeout--;
            }, 1);
          } else if (_req.body.waitForString) {
            //Waits until the supplied character has been received
            var timeout = 1000;
            var interval = setInterval(() => {
              if (bytesToString(port.received).includes(_req.body.waitForString) || timeout == 0) {
                clearInterval(interval);
                return _res.send(getPortSummary(port));
              }
              timeout--;
            }, 1);
          } else {
            //No
            _res.send(getPortSummary(port));
          }
        }
      });
    } else {
      //No transmission, just return
      _res.send(getPortSummary(port));
    }
  });
});

setInterval(() => {  refreshPorts(); }, 500);

async function refreshPorts() {
  //Check for ports not in PORTS
  (await serialport.list()).filter((port) => { return !PORTS[port.path]; }).forEach((portInfo) => {
    var port = new serialport(portInfo.path, { autoOpen: true });
    //Init events and buffers
    port.received = [];
    port.on('close', onPortClose);
    port.on('data', onPortReceive);
    PORTS[port.path] = port;
    info("Found and opened new port " + port.path);
  });
}

function onPortClose(){
  //Port has been closed on the I/O level
  delete PORTS[this.path];
  info("Closed port " + this.path);
}

function onPortReceive(_data) {
  //Port has received data on the I/O level
  info("Port " + this.path + " received " + _data.length + " bytes");
  this.received.push.apply(this.received, _data);
}

function getPortSummary(_port) {
  var summary = {
    received: bytesToString(_port.received)
  };
  CONFIG_PROPERTIES.forEach((prop) => { summary[prop] = _port.settings[prop]; });
  return summary;
}

function bytesToString(_bytes) {
  return String.fromCharCode.apply(null, _bytes);
}
