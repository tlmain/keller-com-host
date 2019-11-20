const fs = require("fs");

info = function(_message){
  log("info", _message);
}

warning = function(_message){
  log("warning", _message);
}

error = function(_message){
  log("error", _message);
}

debug = function(_message){
  log("debug", _message);
}

const colors = {
  info : "\x1b[37m",
  warning: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[36m"
}


function log(_type, _message)
{
  var stack;
   try { throw new Error(''); } catch (error) {
     stack = error.stack.split("\n")[3].split(process.argv[1].split("core.js")[0])[1].split(")")[0];
   }
   var line = "<" + new Date().toLocaleString() + "> [" + stack + "] (" + _type + "): " + (typeof(_message) == "object" ? JSON.stringify(_message, null, 1) : _message);
   fs.appendFile('./core.log', line + "\r\n", () => {});
  console.log(colors[_type] + "%s\x1b[0m", line);
}
