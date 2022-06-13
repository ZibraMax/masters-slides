import { FEMViewer } from "./FEMViewer.js";

let path_str =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/main/results/SiCube_l1_500_0_000_L_20_436_nx_14.json";
let magnif = 30;
let path = `${path_str}`;
const canvas = document.getElementById("model-view");
const nodoTexto = document.getElementById("textNodo");

const O = new FEMViewer(canvas, magnif);
await O.loadJSON(path);
O.init();
O.setStep(6);

nodoTexto.innerHTML = `Mode ${O.step + 1}`;
document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);

const bl = document.getElementById("bl");
const br = document.getElementById("br");
bl.addEventListener(
	"click",
	() => {
		O.prevSolution();
		nodoTexto.innerHTML = `Mode ${O.step + 1}`;
	},
	false
);
br.addEventListener(
	"click",
	() => {
		O.nextSolution();
		nodoTexto.innerHTML = `Mode ${O.step + 1}`;
	},
	false
);
