//init commit






app.get("/api/:device/receive/bytes", async (_req, _res) => {
  //Params: count, flag
  logApi(_req);
  _res.send();
});

app.get("/api/:device/receive/string", async (_req, _res) => {
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
