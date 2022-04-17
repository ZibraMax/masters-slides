import { FEMViewer } from "./FEMViewer.js";
import { GraphViewer } from "./GraphViewer.js";

let path_str =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/main/results/SiCube_l2_0_0_000_L_14_999.json";
let magnif = 30;
let path = `${path_str}`;
const canvas = document.getElementById("model-view");
const grafica = document.getElementById("graph-view");
const nodoTexto = document.getElementById("textNodo");
const select = document.getElementById("zselect");

const O = new FEMViewer(canvas, magnif);
await O.loadJSON(path);
O.init();
O.setStep(6);
O.reset();

nodoTexto.innerHTML = `Mode ${O.step + 1}`;
document.addEventListener("visibilitychange", (e) =>
	O.handleVisibilityChange(e)
);

const path_index =
	"https://raw.githubusercontent.com/ZibraMax/masters-slides/main/results/index.csv";
const OG = new GraphViewer(grafica, O);
await OG.loadResultsIndex(path_index);
OG.init(0.3);

const trace = {
	x: [0.062277527, 0.078879991, 0.107473265, 0.168512597],
	y: [1.689873418, 1.613924051, 1.379746835, 0.930379747],
	type: "scatter",
	line: { shape: "spline", dash: "dot" },
	name: "Ramirez (2006)",
};
OG.addTrace(trace);
OG.div.on("plotly_click", OG.onClick.bind(OG));

select.addEventListener("change", () => {
	OG.changeZ(parseFloat(select.value));
	OG.div.on("plotly_click", OG.onClick.bind(OG));
});

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
canvas.addEventListener("mousedown", O.onDocumentMouseDown.bind(O));
