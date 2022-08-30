import * as THREE from "./three.module.js";

class Element {
	coords;
	gdls;
	Ue;
	geometry;
	constructor(coords, gdls) {
		this.coords = coords;
		this.gdls = gdls;
		this.Ue = [];
	}
	setUe(U, svs = true) {
		this.Ue = [];
		for (const v of this.gdls) {
			const u = [];
			for (const d of v) {
				u.push(U[d]);
			}
			this.Ue.push(u);
		}

		if (svs) this.giveSecondVariableSolution();
	}
	setGeometryCoords(Ue, mult, parent_geometry, line_geometry) {
		if (!Ue) {
			Ue = [];
			const a = Array(this.coords.length).fill(0.0);
			Ue.push(a);
			Ue.push(a);
			Ue.push(a);
		}

		if (!mult) {
			mult = 1.0;
		}

		if (!parent_geometry) {
			parent_geometry = this.geometry;
		}
		let count = parent_geometry.attributes.position.count;
		for (let i = 0; i < count; i++) {
			const node = this.order[i];
			const verticei = this.coords[node];
			parent_geometry.attributes.position.setX(
				i,
				verticei[0] + this.modifier[i][0] + Ue[0][node] * mult
			);
			parent_geometry.attributes.position.setY(
				i,
				verticei[1] + this.modifier[i][1] + Ue[1][node] * mult
			);
			parent_geometry.attributes.position.setZ(
				i,
				verticei[2] + this.modifier[i][2] + Ue[2][node] * mult
			);
		}
		parent_geometry.attributes.position.needsUpdate = true;
		parent_geometry.computeVertexNormals();

		if (line_geometry) {
			count = line_geometry.attributes.position.count;
			for (let i = 0; i < count; i++) {
				const node = this.line_order[i];
				const verticei = this.coords[node];
				line_geometry.attributes.position.setX(
					i,
					verticei[0] + this.modifier[i][0] + Ue[0][node] * mult
				);
				line_geometry.attributes.position.setY(
					i,
					verticei[1] + this.modifier[i][1] + Ue[1][node] * mult
				);
				line_geometry.attributes.position.setZ(
					i,
					verticei[2] + this.modifier[i][2] + Ue[2][node] * mult
				);
			}
			line_geometry.attributes.position.needsUpdate = true;
			line_geometry.computeVertexNormals();
		}
	}
	J(_z) {
		const dpsis = math.transpose(this.dpsi(_z));
		const j = math.multiply(dpsis, this.coords_o);
		return [j, dpsis];
	}
	T(_z) {
		let p = this.psi(_z);
		return [math.multiply(p, this.coords_o), p];
	}
	inverseMapping(x0) {
		let zi = [0.15, 0.15, 0.15];
		for (let i = 0; i < 100; i++) {
			const xi = math.add(x0, math.multiply(this.T(zi)[0], -1));
			const [J, dpz] = this.J(zi);
			const _J = math.inv(J);
			const dz = math.multiply(_J, xi);
			zi = math.add(zi, dz);
			if (math.sum(math.abs(dz)) < 0.0000001) {
				return zi;
			}
		}
		return zi;
	}
	giveSecondVariableSolution() {
		this.dus = [];
		for (const z of this.domain) {
			const [J, dpz] = this.J(z);
			const _J = math.inv(J);
			const dpx = math.multiply(_J, dpz);
			this.dus.push(math.multiply(this.Ue, math.transpose(dpx)));
		}
		this.calculateStrain();
	}
	setMaxDispNode(colorMode) {
		this.colors = Array(this.order.length).fill(0.0);
		let variable = math.transpose(this.Ue);
		if (colorMode == "epsx") {
			variable = this.epsilons;
			for (let i = 0; i < this.order.length; i++) {
				const gdl = this.order[i];
				this.colors[i] = variable[gdl][0];
			}
		} else {
			for (let i = 0; i < this.order.length; i++) {
				const gdl = this.order[i];
				let color = 0.0;
				for (const v of variable[gdl]) {
					color += v ** 2;
				}
				this.colors[i] = color ** 0.5;
			}
		}
	}
}
class Element3D extends Element {
	constructor(coords, gdls) {
		super(coords, gdls);
	}
	isInside(x) {
		return false;
	}
	calculateStrain() {
		this.epsilons = [];
		for (const du of this.dus) {
			if (du.length == 3) {
				const exx = du[0][0];
				const eyy = du[1][1];
				const ezz = du[2][2];

				const exy = du[0][1] + du[1][0];
				const exz = du[0][2] + du[2][0];
				const eyz = du[1][2] + du[2][1];
				const epsilon = [exx, eyy, ezz, exz, eyz, exy];
				this.epsilons.push(epsilon);
			} else {
				const exx = du[0][0];
				const eyy = du[1][1];

				const exy = du[0][1] + du[1][0];
				const epsilon = [exx, eyy, exy];
				this.epsilons.push(epsilon);
			}
		}
	}
	postProcess(C, calculateStress) {
		this.sigmas = [];
		this.epsilons = [];
		for (const du of this.dus) {
			const exx = du[0][0];
			const eyy = du[1][1];
			const ezz = du[2][2];

			const exy = du[0][1] + du[1][0];
			const exz = du[0][2] + du[2][0];
			const eyz = du[1][2] + du[2][1];
			const epsilon = [exx, eyy, ezz, exz, eyz, exy];
			this.epsilons.push(epsilon);
			if (calculateStress) {
				const sigma = math.multiply(C, epsilon);
				this.sigmas.push(sigma);
			}
		}
	}
}

class Brick extends Element3D {
	order;
	line_order;
	constructor(coords, gdls) {
		super(coords, gdls);
		this.coords_o = coords;
		this.domain = [
			[-1, -1, -1],
			[1, -1, -1],
			[1, 1, -1],
			[-1, 1, -1],
			[-1, -1, 1],
			[1, -1, 1],
			[1, 1, 1],
			[-1, 1, 1],
		];
		this.geometry = new THREE.BoxGeometry(1);
		this.order = [
			6, 2, 5, 1, 3, 7, 0, 4, 3, 2, 7, 6, 4, 5, 0, 1, 7, 6, 4, 5, 2, 3, 1,
			0,
		];
		this.line_order = [0, 1, 2, 3, 0, 4, 5, 1, 5, 6, 2, 6, 7, 3];
		this.modifier = [
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
		];
	}
	psi(_z) {
		const z = _z[0];
		const n = _z[1];
		const g = _z[2];
		return [
			(1.0 / 8.0) * (1 - z) * (1 - n) * (1 - g),
			(1.0 / 8.0) * (1 + z) * (1 - n) * (1 - g),
			(1.0 / 8.0) * (1 + z) * (1 + n) * (1 - g),
			(1.0 / 8.0) * (1 - z) * (1 + n) * (1 - g),
			(1.0 / 8.0) * (1 - z) * (1 - n) * (1 + g),
			(1.0 / 8.0) * (1 + z) * (1 - n) * (1 + g),
			(1.0 / 8.0) * (1 + z) * (1 + n) * (1 + g),
			(1.0 / 8.0) * (1 - z) * (1 + n) * (1 + g),
		];
	}
	dpsi(_z) {
		const x = _z[0];
		const y = _z[1];
		const z = _z[2];
		return [
			[
				0.125 * (1 - z) * (y - 1),
				0.125 * (1 - z) * (x - 1),
				-0.125 * (1 - x) * (1 - y),
			],
			[
				0.125 * (1 - y) * (1 - z),
				0.125 * (1 - z) * (-x - 1),
				-0.125 * (1 - y) * (x + 1),
			],
			[
				0.125 * (1 - z) * (y + 1),
				0.125 * (1 - z) * (x + 1),
				-0.125 * (x + 1) * (y + 1),
			],
			[
				0.125 * (1 - z) * (-y - 1),
				0.125 * (1 - x) * (1 - z),
				-0.125 * (1 - x) * (y + 1),
			],
			[
				0.125 * (1 - y) * (-z - 1),
				-0.125 * (1 - x) * (z + 1),
				0.125 * (1 - x) * (1 - y),
			],
			[
				0.125 * (1 - y) * (z + 1),
				-0.125 * (x + 1) * (z + 1),
				0.125 * (1 - y) * (x + 1),
			],
			[
				0.125 * (y + 1) * (z + 1),
				0.125 * (x + 1) * (z + 1),
				0.125 * (x + 1) * (y + 1),
			],
			[
				-0.125 * (y + 1) * (z + 1),
				0.125 * (1 - x) * (z + 1),
				0.125 * (1 - x) * (y + 1),
			],
		];
	}
}

class Tetrahedral extends Element3D {
	order;
	line_order;
	constructor(coords, gdls) {
		super(coords, gdls);
		this.coords_o = coords;
		this.domain = [
			[0.0, 0.0, 0.0],
			[1.0, 0.0, 0.0],
			[0.0, 1.0, 0.0],
			[0.0, 0.0, 1.0],
		];
		this.geometry = new THREE.TetrahedronGeometry(1);
		this.order = [1, 0, 2, 3, 2, 0, 3, 0, 1, 3, 1, 2];
		this.line_order = [0, 1, 2, 0, 3, 1, 3, 2];
		this.modifier = [
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
		];
	}
	psi(_z) {
		let x = _z[0];
		let y = _z[1];
		let z = _z[2];
		let L1 = 1 - x - y - z;
		let L2 = x;
		let L3 = y;
		let L4 = z;
		return [L1, L2, L3, L4];
	}
	dpsi(_z) {
		const kernell = 0.0;
		return [
			[-1.0 + kernell, -1.0 + kernell, -1.0 + kernell],
			[1.0 + kernell, 0.0 + kernell, 0.0 + kernell],
			[0.0 + kernell, 1.0 + kernell, 0.0 + kernell],
			[0.0 + kernell, 0.0 + kernell, 1.0 + kernell],
		];
	}
}

class Lineal extends Element3D {
	order;
	line_order;
	constructor(coords, gdls, tama) {
		super(coords, gdls);
		this.geometry = new THREE.BoxGeometry(1);
		this.order = [
			1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0,
			0,
		];
		this.line_order = [0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
		const h = tama / 10.0;
		this.modifier = [
			[0.0, h, h],
			[0.0, h, h],
			[0.0, h, 0.0],
			[0.0, h, 0.0],
			[0.0, 0.0, h],
			[0.0, 0.0, h],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, h],
			[0.0, h, h],
			[0.0, 0.0, h],
			[0.0, h, h],
			[0.0, 0.0, 0.0],
			[0.0, h, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, h, 0.0],
			[0.0, 0.0, h],
			[0.0, h, h],
			[0.0, 0.0, 0.0],
			[0.0, h, 0.0],
			[0.0, h, h],
			[0.0, 0.0, h],
			[0.0, h, 0.0],
			[0.0, 0.0, 0.0],
		];
	}
	psi(_z) {
		return 0.0;
	}
	dpsi(_z) {
		return 0.0;
	}
}

class Triangular extends Element3D {
	order;
	line_order;
	constructor(coords, gdls, tama) {
		super(coords, gdls);
		const c = [];
		for (let i = 0; i < coords.length; i++) {
			const x = coords[i][0];
			const y = coords[i][1];
			c.push([x, y]);
		}
		this.geometry = new THREE.BoxGeometry(1);
		this.domain = [
			[0, 0],
			[1, 0],
			[0, 1],
		];
		this.order = [
			2, 2, 1, 1, 2, 2, 0, 0, 2, 2, 2, 2, 0, 1, 0, 1, 2, 2, 0, 1, 2, 2, 1,
			0,
		];
		this.line_order = [0, 1, 2, 2, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2];
		const h = tama / 20.0;
		const orderori = [
			6, 2, 5, 1, 3, 7, 0, 4, 3, 2, 7, 6, 4, 5, 0, 1, 7, 6, 4, 5, 2, 3, 1,
			0,
		];
		this.modifier = [
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
		];
		for (let k = 0; k < this.modifier.length; k++) {
			if (orderori[k] > 3) {
				this.modifier[k][2] = h;
			}
		}
	}
	psi(_z) {
		return 0.0;
	}
	dpsi(_z) {
		return 0.0;
	}
}

class Quadrilateral extends Element3D {
	order;
	line_order;
	constructor(coords, gdls, tama) {
		super(coords, gdls);
		const c = [];
		for (let i = 0; i < coords.length; i++) {
			const x = coords[i][0];
			const y = coords[i][1];
			c.push([x, y]);
		}
		this.coords_o = c;
		this.geometry = new THREE.BoxGeometry(1);
		this.order = [
			2, 2, 1, 1, 3, 3, 0, 0, 3, 2, 3, 2, 0, 1, 0, 1, 3, 2, 0, 1, 2, 3, 1,
			0,
		];
		this.domain = [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
		];
		this.line_order = [0, 1, 2, 3, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
		const h = tama / 20.0;
		const orderori = [
			6, 2, 5, 1, 3, 7, 0, 4, 3, 2, 7, 6, 4, 5, 0, 1, 7, 6, 4, 5, 2, 3, 1,
			0,
		];
		this.modifier = [
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0],
		];
		for (let k = 0; k < this.modifier.length; k++) {
			if (orderori[k] > 3) {
				this.modifier[k][2] = h;
			}
		}
	}
	psi(_z) {
		return 0.0;
	}
	dpsi(_z) {
		return 0.0;
	}
}

class TetrahedralO2 extends Tetrahedral {
	constructor(coords, gdls) {
		super(coords, gdls);
	}
	psi(z) {
		return 0.0;
	}
	dpsi(z) {
		return 0.0;
	}
}

class BrickO2 extends Brick {
	constructor(coords, gdls) {
		super(coords, gdls);
	}
	psi(z) {
		return 0.0;
	}
	dpsi(z) {
		return 0.0;
	}
}

class TriangularO2 extends Triangular {
	constructor(coords, gdls, tama) {
		super(coords, gdls, tama);
	}
	psi(z) {
		return 0.0;
	}
	dpsi(z) {
		return 0.0;
	}
}

class Serendipity extends Quadrilateral {
	constructor(coords, gdls, tama) {
		super(coords, gdls, tama);
	}
	psi(z) {
		return [
			0.25 * (1.0 - z[0]) * (1.0 - z[1]) * (-1.0 - z[0] - z[1]),
			0.25 * (1.0 + z[0]) * (1.0 - z[1]) * (-1.0 + z[0] - z[1]),
			0.25 * (1.0 + z[0]) * (1.0 + z[1]) * (-1.0 + z[0] + z[1]),
			0.25 * (1.0 - z[0]) * (1.0 + z[1]) * (-1.0 - z[0] + z[1]),
			0.5 * (1.0 - z[0] ** 2.0) * (1.0 - z[1]),
			0.5 * (1.0 + z[0]) * (1.0 - z[1] ** 2.0),
			0.5 * (1.0 - z[0] ** 2.0) * (1.0 + z[1]),
			0.5 * (1.0 - z[0]) * (1.0 - z[1] ** 2.0),
		];
	}
	dpsi(z) {
		return [
			[
				-0.25 * (z[1] - 1.0) * (2.0 * z[0] + z[1]),
				-0.25 * (z[0] - 1.0) * (2.0 * z[1] + z[0]),
			],
			[
				-0.25 * (z[1] - 1.0) * (2.0 * z[0] - z[1]),
				0.25 * (z[0] + 1.0) * (2.0 * z[1] - z[0]),
			],
			[
				0.25 * (z[1] + 1.0) * (2.0 * z[0] + z[1]),
				0.25 * (z[0] + 1.0) * (2.0 * z[1] + z[0]),
			],
			[
				0.25 * (z[1] + 1.0) * (2.0 * z[0] - z[1]),
				-0.25 * (z[0] - 1.0) * (2.0 * z[1] - z[0]),
			],
			[(z[1] - 1.0) * z[0], 0.5 * (z[0] ** 2.0 - 1.0)],
			[-0.5 * (z[1] ** 2.0 - 1.0), -z[1] * (z[0] + 1.0)],
			[-(z[1] + 1.0) * z[0], -0.5 * (z[0] ** 2.0 - 1.0)],
			[0.5 * (z[1] ** 2.0 - 1.0), z[1] * (z[0] - 1.0)],
		];
	}
}

export {
	Brick,
	BrickO2,
	Tetrahedral,
	TetrahedralO2,
	Lineal,
	Triangular,
	TriangularO2,
	Quadrilateral,
	Serendipity,
};
