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

var PORT_INSTANCES = {};


function openPort(_name, _baud) {
  try {
    //Check for existing
    var existing = PORT_INSTANCES[_name];
    if (existing) {
      //Close first, then reopen
      closePort(_name);
    }
    //Open port
    var port = new serialport("/dev/" + _name, {
      baudRate: _baud
    });
    //Init event listeners
    port.on('open', onPortOpen);
    port.on('close', onPortClose);
    port.on('data', onPortReceive);
    port.open = false;
    //Add to port repository
    PORT_INSTANCES[_name] = port;
    return port;
  } catch(e) {
    error("Failed to open port " + _name + " @ " + _baud + " e: " + e);
    return null;
  }
}

function closePort(_name, _baud) {
  try {
    var port = PORT_INSTANCES[_name];
    if (port) {
      port.close();
      info("Port " + _name + " closed");
      return true;
    } else {
      warning("Port " + _name + " already closed");
      return true;
    }
  } catch(e) {
    error("Failed to close port " + _name + " e: " + e);
    return false;
  }
}


function onPortOpen(){
  info("Port " + this.path + " opened @ " + this.baudRate + " baud");
  this.open = true;
  this.receiveBuffer = [];
}

function onPortClose(){
  info("Port " + this.path + " closed");
  this.open = false;
}

function onPortReceive(_data) {
  info("Port " + this.path + " received " + _data.length + " bytes");
  this.receiveBuffer.push.apply(this.receiveBuffer, _data);
}

function getPortState(_port) {
  return {
    port: _port.path.replace("/dev/", ""),
    baud: _port.baudRate,
    open: _port.open
  };
}


// API METHODS /////////////////////////////////////////////////////////////////

app.post("/api/:port", async (_req, _res) => {
  // Open Port or write data
  if (_req.body && Object.keys(_req.body).length > 0) {
    //Write data to port
    var port = PORT_INSTANCES[_req.params.port];
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

app.get("/api/:port", async (_req, _res) => {
  // Get port state
  var port = PORT_INSTANCES[_req.params.port];
  if (port) {
    _res.send(JSON.stringify(getPortState(port)));
  } else {
    _res.status(500).send("{}");
  }
});



app.get("/api/:port/receive/bytes", async (_req, _res) => {
  //Params: count, flag
  logApi(_req);
  _res.send();
});

app.get("/api/:port/receive/string", async (_req, _res) => {
  logApi(_req);
  _res.send();
});


app.get("/api/:device/state", async (_req, _res) => {
  logApi(_req);
  _res.send();
});


app.get("/api/:device/received", async (_req, _res) => {
  logApi(_req);
  _res.send();
});
