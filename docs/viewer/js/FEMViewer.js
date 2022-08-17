import * as THREE from "./build/three.module.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.16/+esm";
import { OrbitControls } from "./build/OrbitControls.js";
import * as BufferGeometryUtils from "./build/BufferGeometryUtils.js";
import { AxisGridHelper } from "./build/minigui.js";
import { Lut } from "./build/Lut.js";
import {
	Brick,
	BrickO2,
	Tetrahedral,
	TetrahedralO2,
	Lineal,
	Triangular,
	TriangularO2,
	Quadrilateral,
	Serendipity,
} from "./build/Elements.js";

const types = {
	B1V: Brick,
	B2V: BrickO2,
	TE1V: Tetrahedral,
	TE2V: TetrahedralO2,
	L1V: Lineal,
	T1V: Triangular,
	T2V: TriangularO2,
	C1V: Quadrilateral,
	C2V: Serendipity,
};

const functions = {
	MAX: (x) => Math.max(...x),
	MIN: (x) => Math.min(...x),
	AVE: (x) => x.reduce((a, b) => a + b, 0) / x.length,
};

class FEMViewer {
	json_path;
	nodes;
	nvn;
	dictionary;
	types;
	solutions;
	U;
	step;
	max_disp;
	size;
	elements;
	canvas;
	camera;
	scene;
	controls;
	constructor(canvas, magnif, rot) {
		if (!magnif) {
			magnif = 100;
		}
		// FEM
		this.canvas = canvas;
		this.rot = rot;
		this.nodes = [];
		this.nvn = -1;
		this.dictionary = [];
		this.types = [];
		this.solutions = [];
		this.solutions_info = [];
		this.U = [];
		this.step = 0;
		this.max_disp = 0.0;
		this.size = 0.0;
		this.elements = [];
		this.info = "";
		this.infoDetail = "";

		this.calculateStress = false;
		this.C = Array(6).fill(Array(6).fill(0.0));
		// THREE JS
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		this.renderer.autoClear = false;

		this.delta = 0;
		this.interval = 1 / 120;
		this.clock = new THREE.Clock();
		this.bufferGeometries = [];
		this.bufferLines = [];
		this.model = new THREE.Object3D();
		this.colors = false;
		this.animate = true;
		this.magnif = magnif;
		this.mult = 1.0;
		this.side = 1.0;
		this.max_disp = 0.0;
		this.draw_lines = true;

		this.mode = "MAX";
		this.colorMode = "DISP";
		this.secondVariable = 0;
		this.dinamycColors = false;
		this.lut = new Lut();

		this.gui = new GUI({ title: "Settings" });
		this.gui.close();
		this.first_color = [78 / 255, 51 / 255, 255 / 255];
		//248 / 360, 184 / 360
		this.second_color = [255 / 255, 51 / 255, 51 / 255];
		this.settings();
	}
	defineElasticityTensor(C) {
		this.calculateStress = true;
		this.C = C;
	}

	async loadJSON(json_path) {
		this.json_path = json_path;
		const response = await fetch(this.json_path);
		const jsondata = await response.json();
		this.parseJSON(jsondata);
	}
	reset() {
		this.animate = false;

		for (let i = 0; i < this.elements.length; i++) {
			this.elements[i].geometry.dispose();
			this.bufferGeometries.pop().dispose();
			this.bufferLines.pop().dispose();
		}
		this.model.remove(this.mesh);
		this.model.remove(this.contour);

		this.mergedGeometry.dispose();
		this.mergedLineGeometry.dispose();
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.contour.geometry.dispose();
		this.contour.material.dispose();

		this.renderer.renderLists.dispose();
		this.bufferGeometries = [];
		this.bufferLines = [];

		this.nodes = [];
		this.dictionary = [];
		this.solutions = [];
		this.solutions_info = [];
		this.step = 6;
		this.U = undefined;
		this.elements = [];
		this.types = [];
	}

	settings() {
		THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);
		// Scene settings
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(1, 1, 1);
		// Camera settings
		const fov = 40;
		const aspect = 2; // the canvas default
		const near = 0.01;
		const far = 200;
		this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		this.camera.position.set(25, 25, 25);
		this.camera.lookAt(0, 0, 0);
		this.scene.add(this.camera);

		// Controls
		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.target.set(0, 0, 0);
		this.controls.update();

		// Lights
		this.light2 = new THREE.AmbientLight(0xffffff, 0.0);
		const color = 0xffffff;
		const intensity = 0.8;
		this.light = new THREE.PointLight(color, intensity);
		this.camera.add(this.light);
		this.scene.add(this.light2);

		// GUI
		this.gui.add(this, "rot").name("Rotation").listen();
		this.gui
			.add(this, "draw_lines")
			.onChange(this.updateLines.bind(this))
			.name("Draw lines");

		// ESTO ES SOLO PARA DESPLAZAMIENTOS ESPECIFICAMENTE

		this.gui
			.add(this, "animate")
			.name("Animation")
			.listen()
			.onChange(() => {
				if (!this.animate) {
					this.mult = 1.0;
					this.updateMeshCoords();
				}
			});

		this.gui
			.add(this, "magnif", 0, 1000)
			.name("Disp multiplier")
			.onChange(() => {
				this.updateMeshCoords();
			});
	}
	updateColorVariable() {
		for (const e of this.elements) {
			e.setMaxDispNode(this.colorMode, this.secondVariable);
		}

		let max_disp = 0.0;
		let min_disp = 9999999999999;
		if (this.colorMode == "DISP") {
			const variable = this.U.flat();
			max_disp = Math.max(max_disp, ...variable);
			min_disp = Math.min(min_disp, ...variable);
		} else if (this.colorMode == "STRESS") {
			for (const e of this.elements) {
				const variable = e.colors;
				max_disp = Math.max(max_disp, ...variable);
				min_disp = Math.min(min_disp, ...variable);
			}
		} else if (this.colorMode == "STRAIN") {
			for (const e of this.elements) {
				const variable = e.colors;
				max_disp = Math.max(max_disp, ...variable);
				min_disp = Math.min(min_disp, ...variable);
			}
		}
		this.max_disp = this.max_disp;
		this.lut.setMax(max_disp);
		this.lut.setMin(min_disp);
	}
	updateCamera() {
		this.camera.updateProjectionMatrix();
	}

	updateMaterial() {
		if (this.colors) {
			this.material = new THREE.MeshLambertMaterial({
				vertexColors: true,
			});
			this.light2.intensity = 1.0;
			this.light.intensity = 0.0;
		} else {
			this.material = new THREE.MeshLambertMaterial({
				color: "#dc2c41",
				emissive: "#dc2c41",
			});
			this.light2.intensity = 0.0;
			this.light.intensity = 1.0;
		}
	}

	handleVisibilityChange(e) {
		if (document.visibilityState === "hidden") {
			this.clock.stop();
		} else {
			this.clock.start();
		}
	}

	update() {
		requestAnimationFrame(this.update.bind(this));
		this.delta += this.clock.getDelta();
		if (this.delta > this.interval) {
			// The draw or time dependent code are here
			this.render(this.delta);

			this.delta = this.delta % this.interval;
		}
	}

	resizeRendererToDisplaySize() {
		const canvas = this.renderer.domElement;
		const pixelRatio = window.devicePixelRatio;
		const width = (canvas.clientWidth * pixelRatio) | 0;
		const height = (canvas.clientHeight * pixelRatio) | 0;
		const needResize = canvas.width !== width || canvas.height !== height;
		if (needResize) {
			this.renderer.setSize(width, height, false);
		}
		return needResize;
	}
	updateMeshCoords() {
		for (let i = 0; i < this.elements.length; i++) {
			const e = this.elements[i];
			const Ue = [];
			for (const ue of e.Ue) {
				Ue.push(ue);
			}
			for (let j = Ue.length; j < 3; j++) {
				Ue.push(Array(e.coords.length).fill(0.0));
			}

			if (this.draw_lines) {
				e.setGeometryCoords(
					Ue,
					this.magnif * this.mult,
					this.bufferGeometries[i],
					this.bufferLines[i]
				);
			} else {
				e.setGeometryCoords(
					Ue,
					this.magnif * this.mult,
					this.bufferGeometries[i]
				);
			}
			if (this.colors) {
				let max_disp_nodes = e.max_disp_nodes;
				let amount = max_disp_nodes / this.max_disp;
				if (this.colorMode == "DISP") {
					amount *= !this.dinamycColors ? 1 : Math.abs(this.mult);
				} else {
					amount *= !this.dinamycColors ? 1 : this.mult;
				}
				if (this.colorMode != "DISP") {
					amount += 1.0;
					amount /= 2;
				}
				const colors = this.bufferGeometries[i].attributes.color;
				for (let j = 0; j < e.order.length; j++) {
					let disp = e.colors[j];
					const color = this.lut.getColor(disp);
					colors.setXYZ(j, color.r, color.g, color.b);
				}
			}
		}

		this.mergedGeometry.dispose();
		this.mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(
			this.bufferGeometries,
			false
		);
		this.mesh.geometry = this.mergedGeometry;
		this.mesh.material = this.material;
		this.mesh.material.needsUpdate = true;

		if (this.draw_lines) {
			this.mergedLineGeometry.dispose();
			this.mergedLineGeometry = BufferGeometryUtils.mergeBufferGeometries(
				this.bufferLines,
				false
			);
			this.contour.geometry = this.mergedLineGeometry;
		}
	}

	rotateModel() {
		this.model.rotation.z += 0.005;
	}

	render(time) {
		if (typeof time == "number") {
			time = time || 0;
		} else {
			time = 0.0;
		}
		this.mult += time * this.side;
		if (this.mult > 1) {
			this.side = -1.0;
			this.mult = 1.0;
		} else if (this.mult < -1) {
			this.side = 1.0;
			this.mult = -1.0;
		}
		if (!this.animate) {
			this.mult = 1.0;
		}

		// console.log(this.mult);

		// Specific part of shit
		if (this.rot) {
			this.rotateModel();
		} else {
			if (this.animate) {
				this.updateMeshCoords();
			}
		}
		if (this.resizeRendererToDisplaySize()) {
			const canvas = this.renderer.domElement;
			this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
			this.camera.updateProjectionMatrix();
		}
		this.renderer.render(this.scene, this.camera);
	}

	zoomExtents() {
		let vFoV = this.camera.getEffectiveFOV();
		let hFoV = this.camera.fov * this.camera.aspect;

		let FoV = Math.min(vFoV, hFoV);
		let FoV2 = FoV / 2;

		let dir = new THREE.Vector3();
		this.camera.getWorldDirection(dir);

		let bb = this.mesh.geometry.boundingBox;
		let bs = this.mesh.geometry.boundingSphere;
		let bsWorld = bs.center.clone();
		this.mesh.localToWorld(bsWorld);

		let th = (FoV2 * Math.PI) / 180.0;
		let sina = Math.sin(th);
		let R = bs.radius;
		let FL = R / sina;

		let cameraDir = new THREE.Vector3();
		this.camera.getWorldDirection(cameraDir);

		let cameraOffs = cameraDir.clone();
		cameraOffs.multiplyScalar(-FL);
		let newCameraPos = bsWorld.clone().add(cameraOffs);

		this.camera.position.copy(newCameraPos);
		this.camera.lookAt(bsWorld);
		this.controls.target.copy(bsWorld);

		this.controls.update();
	}

	updateLines() {
		if (this.draw_lines) {
			this.model.add(this.contour);
		} else {
			this.model.remove(this.contour);
		}
	}

	init() {
		this.animate = true;
		this.createElements();
		this.createLines();
		this.updateU();

		this.mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(
			this.bufferGeometries,
			true
		);
		this.updateMaterial();
		const line_material = new THREE.LineBasicMaterial({
			color: "black",
			linewidth: 3,
		});
		this.mergedLineGeometry = BufferGeometryUtils.mergeBufferGeometries(
			this.bufferLines,
			true
		);
		this.contour = new THREE.Line(this.mergedLineGeometry, line_material);
		// this.model.add(this.contour);

		this.mesh = new THREE.Mesh(this.mergedGeometry, this.material);
		this.model.add(this.mesh);

		new AxisGridHelper(this.scene, 0);

		this.scene.add(this.model);
		this.renderer.render(this.scene, this.camera);
		this.zoomExtents();
		this.updateLines();
		window.addEventListener("resize", this.render.bind(this));
		requestAnimationFrame(this.update.bind(this));
	}
	setStep(step) {
		this.step = step;
		this.updateU();
		this.updateMeshCoords();
	}

	parseJSON(jsondata) {
		const norm = 1.0 / Math.max(...jsondata["nodes"].flat());
		// console.log(norm);
		this.nodes.push(...jsondata["nodes"]);

		for (let i = 0; i < this.nodes.length; i++) {
			const node = this.nodes[i];
			for (let j = 0; j < node.length; j++) {
				this.nodes[i][j] *= norm;
			}
		}
		this.nvn = jsondata["nvn"];
		for (let i = 0; i < this.nodes.length; i++) {
			for (let j = this.nodes[i].length; j < 3; j++) {
				this.nodes[i].push(0.0); //Coordinate completition
			}
		}
		this.dictionary.push(...jsondata["dictionary"]);
		this.types.push(...jsondata["types"]);
		if (jsondata["solutions"] == undefined) {
			if (
				jsondata["disp_field"] == undefined ||
				jsondata["disp_field"].length == 0
			) {
				this.solutions = [
					Array(this.nodes.length * this.nvn).fill(0.0),
				];
				this.solutions_info = [{ info: "Not solved" }];
			}
		} else {
			if (jsondata["disp_field"] == undefined) {
				for (let i = 0; i < jsondata["solutions"].length; i++) {
					let solution = jsondata["solutions"][i];

					this.solutions.push(solution["U"]);
					this.solutions_info.push({ ...solution["info"], index: i });
				}
			} else {
				this.solutions.push(...jsondata["disp_field"]);
				this.solutions_info = [];
				for (let i = 0; i < this.solutions.length; i++) {
					this.solutions_info.push({
						info: "Not info",
						index: i,
					});
				}
			}
		}
		const solutions_info_str = [];
		for (let i = 0; i < this.solutions_info.length; i++) {
			solutions_info_str.push(i);
		}
		this.gui
			.add(this, "step", solutions_info_str)
			.onChange(this.updateSolution.bind(this))
			.listen()
			.name("Solution");
		this.gui
			.add(this, "info", Object.keys(this.solutions_info[this.step]))
			.listen()
			.onChange(this.updateSolutionInfo.bind(this));
		this.gui.add(this, "infoDetail", this.infoDetail).listen();
		this.info = Object.keys(this.solutions_info[this.step])[0];
		this.infoDetail = this.solutions_info[this.step][this.info];

		for (let s = 0; s < this.solutions.length; s++) {
			for (let i = 0; i < this.solutions[s].length; i++) {
				this.solutions[s][i] *= norm;
			}
		}

		const secon_coords = this.nodes[0].map((_, colIndex) =>
			this.nodes.map((row) => row[colIndex])
		);

		let sizex =
			Math.max(...secon_coords[0].flat()) -
			Math.min(...secon_coords[0].flat());
		let sizey =
			Math.max(...secon_coords[1].flat()) -
			Math.min(...secon_coords[1].flat());
		let sizez =
			Math.max(...secon_coords[2].flat()) -
			Math.min(...secon_coords[2].flat());
		for (let i = 0; i < this.nodes.length; i++) {
			this.nodes[i][0] -= sizex / 2;
			this.nodes[i][1] -= sizey / 2;
			this.nodes[i][2] -= sizez / 2;
		}
		this.size =
			Math.max(...this.nodes.flat()) - Math.min(...this.nodes.flat());
	}
	updateSolutionInfo() {
		this.infoDetail = this.solutions_info[this.step][this.info];
	}

	updateU() {
		this.U = this.solutions[this.step];
		for (const e of this.elements) {
			e.setUe(this.U, this.calculateStress);
			if (this.calculateStress) {
				e.postProcess(this.C, this.calculateStress);
			}
		}
		this.updateColorVariable();
	}

	nextSolution() {
		this.step += 1 * (this.step < this.solutions.length - 1);
		this.updateSolution();
	}
	updateSolution() {
		this.updateU();
		this.updateMeshCoords();
		this.updateSolutionInfo();
	}
	prevSolution() {
		this.step -= 1 * (this.step > 0);
		this.updateSolution();
	}

	createElements() {
		this.elements = new Array(this.dictionary.length).fill(0.0);
		for (let i = 0; i < this.dictionary.length; i++) {
			const gdls = this.dictionary[i];
			const egdls = [];
			for (let i = 0; i < this.nvn; i++) {
				const a = [];
				for (const gdl of gdls) {
					a.push(gdl * this.nvn + i);
				}
				egdls.push(a);
			}
			const coords = [];
			for (const node of gdls) {
				coords.push(this.nodes[node]);
			}
			this.elements[i] = new types[this.types[i]](
				coords,
				egdls,
				this.size
			);
			const colors = [];
			for (
				let j = 0;
				j < this.elements[i].geometry.attributes.position.count;
				++j
			) {
				colors.push(1, 1, 1);
			}

			this.elements[i].geometry.setAttribute(
				"color",
				new THREE.Float32BufferAttribute(colors, 3)
			);
			this.bufferGeometries.push(this.elements[i].geometry);
		}
	}
	createLines() {
		for (const e of this.elements) {
			const points = [];
			const count = e.line_order.length;
			for (let j = 0; j < count; j++) {
				const node = e.line_order[j];
				const verticei = e.coords[node];
				points.push(new THREE.Vector3(...verticei));
			}
			const line_geo = new THREE.BufferGeometry().setFromPoints(points);
			this.bufferLines.push(line_geo);
		}
	}
	onDocumentMouseDown(event) {
		// event.preventDefault();
		// const mouse3D = new THREE.Vector2(
		// 	(event.clientX / window.innerWidth) * 2 - 1,
		// 	-(event.clientY / window.innerHeight) * 2 + 1
		// );
		// const raycaster = new THREE.Raycaster();
		// raycaster.setFromCamera(mouse3D, this.camera);
		// const intersects = raycaster.intersectObjects(
		// 	this.invisibleModel.children
		// );
		// // for (const e of intersects) {
		// // 	const index = e.object.userData.elementId;
		// // 	this.elements[index].colors = this.elements[index].colors.map(
		// // 		(x) => 0
		// // 	);
		// // }
		// if (intersects.length > 0) {
		// 	const keleven = intersects[0].object.userData.elementId;
		// 	console.log(keleven);
		// 	const e = this.elements[keleven];
		// 	console.log(e);
		// }
	}
}
export { FEMViewer };
