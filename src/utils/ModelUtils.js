import fs from "fs";

async function loadModels() {
  const models = fetch("/models").then((models) => {
    console.log("Loading...");
    return models;
  });
  return models;
}

export default { loadModels };
