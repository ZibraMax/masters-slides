import { FEMViewer } from "./FEMViewer.js";

let path_str = "../../results/SiCube_l2_0_0_500_L_9_566.json";
let magnif = 30;
let path = `${path_str}`;
const canvas = document.getElementById("model-view");
const nodoTexto = document.getElementById("textNodo");

const O = new FEMViewer(canvas, magnif);
await O.loadJSON(path);
O.init();
O.setStep(6);

nodoTexto.innerHTML = `Solución ${O.step + 1}`;
document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);
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
