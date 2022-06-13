import { FEMViewer } from "./FEMViewer.js";

let path_str =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/main/results/SiCube_l3_0_0_500_L_25_884.json";
let queryString = window.location.search;
if (queryString != "") {
	queryString = queryString.split("?")[1];
	let parametros = new URLSearchParams(queryString);
	let funcion_param = parametros.get("mesh");
	let magnif_param = parametros.get("magnif");
	let cs = parametros.get("c");
	if (funcion_param) {
		path_str = funcion_param;
	}
	if (magnif_param) {
		magnif = parseFloat(magnif_param);
	}
}
let path = path_str;

let magnif = 600;
const canvas = document.getElementById("model-view");
const nodoTexto = document.getElementById("textNodo");

const O = new FEMViewer(canvas, magnif);
await O.loadJSON(path);
O.init();
O.setStep(6);
document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);
