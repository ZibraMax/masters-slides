import { FEMViewer } from "./FEMViewer.js";
let magnif = 600;
let rot = false;

let path_str =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/main/results/SiCube_l3_0_0_500_L_25_884.json";
let queryString = window.location.search;
if (queryString != "") {
	queryString = queryString.split("?")[1];
	let parametros = new URLSearchParams(queryString);
	let funcion_param = parametros.get("mesh");
	let magnif_param = parametros.get("magnif");
	let rot_param = parametros.get("rot");
	if (funcion_param) {
		path_str = funcion_param;
	}
	if (magnif_param) {
		magnif = parseFloat(magnif_param);
	}
	if (rot_param) {
		rot = true;
	}
}
let path = path_str;

const canvas = document.getElementById("model-view");
const nodoTexto = document.getElementById("textNodo");

const O = new FEMViewer(canvas, magnif, rot);
await O.loadJSON(path);
O.init();
O.setStep(6);
document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);
