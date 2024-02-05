const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const ACROPOLIS_APP = express();
const port = 5173 || process.env.PORT;

const distPath = path.join(__dirname, "dist");
ACROPOLIS_APP.use(express.static(distPath));

ACROPOLIS_APP.use(cors());

ACROPOLIS_APP.get("/", (req, res) => {
  res.sendFile("index.html");
});

ACROPOLIS_APP.get("/models", (req, res) => {
  const modelNames = fs.readdirSync(`${distPath}/models`);
  const modelInfo = modelNames
    .map((modelName) => {
      const underscoreIndex = modelName.indexOf("_");

      const name = modelName.slice(underscoreIndex + 1, modelName.length);
      const priority = parseInt(modelName.slice(0, underscoreIndex));

      return {
        name,
        priority,
      };
    })
    .sort((modelA, modelB) => modelA.priority - modelB.priority);
  console.log(modelInfo);
  res.json(modelInfo);
});

ACROPOLIS_APP.listen(port, "0.0.0.0");
