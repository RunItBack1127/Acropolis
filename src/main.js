import { createApp } from "vue";
import "./style.scss";
import App from "./App.vue";

const models = fetch("/models")
  .then((res) => res.json())
.then((models) => {

const app = createApp(App);
app.provide("models", models);
app.mount("#app");
});
