import { FEMViewer } from "./FEMViewer.js";

let path_str =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/master/results/SiCube_l0_5_0_900_L_14_999.json";
let magnif = 100;
let path = `${path_str}`;
const canvas = document.getElementById("model-view");
var O = new FEMViewer(canvas, magnif);
await O.loadJSON(path);
O.init();
O.reset();

document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);
const nodoTexto = document.getElementById("textNodo");
function onDocumentKeyDown(event) {
	const keyCode = event.which;
	if (keyCode == 39) {
		O.nextSolution();
		nodoTexto.innerHTML = `Solución ${O.step + 1}`;
	} else if (keyCode == 37) {
		O.prevSolution();
		nodoTexto.innerHTML = `Solución ${O.step + 1}`;
	}
}
document.addEventListener("keydown", onDocumentKeyDown, false);
const bl = document.getElementById("bl");
const br = document.getElementById("br");
bl.addEventListener(
	"click",
	() => {
		O.prevSolution();
		nodoTexto.innerHTML = `Solución ${O.step + 1}`;
	},
	false
);
br.addEventListener(
	"click",
	() => {
		O.nextSolution();
		nodoTexto.innerHTML = `Solución ${O.step + 1}`;
	},
	false
);
canvas.addEventListener("mousedown", O.onDocumentMouseDown.bind(O));
