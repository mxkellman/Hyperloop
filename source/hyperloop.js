/*

Bugs
* Need intersection between Raleigh and Greenville, Rocky Mt and Fayettville

Small Enhancements


Medium Enhancements


Large Enhancements


*/

/* global d3 */
// /* global google */
/* global Graph */

/* jshint devel:true */

// dv is the namespace used to avoid collisions with other code or libraries
// all static variables and object placeholders

var dv = {
	data: {},
	dato: {},
	keys: {},

	load: {},
	process: {},
	state: {},

	dim: {},
	scale: {},
	path: {},

	html: {},
	svg: {},

	write: {},
	draw: {},

	create: {},
	update: {},
	
	calc: {},
	format: {},

	util: {}
};

// dv.opt stores all options that can be changed "on the fly"
dv.opt = {
	path: {
		msa: 'data/MSAPlaced.csv',
		links: 'data/Links.csv',
		highways: 'data/Highways.json',
		statemap: 'data/us-states.json'
	},
	cities: {
		quant: 50,
		col: 'Population',
		allstates: false,
		exclude: {}
	},
	city: {
		radius: {
			min: 3,
			max: 12
		},
		stroke: {
			min: 1,
			max: 2
		},
		font: {
			min: 14,
			max: 20
		},
		popmin: 1000000,
		near: {
			max: 900 * 1610,
			min: 60 * 1610,
		},
	},
	rose: {
		petals: 5,
		distances: [1,2,3,4,5]
	},
	map: {
		scale: 1.34,
		grid: 10
	}
};

/* LOAD/PROCESS: Load data from external files, Process data */

// retrieves the data from files and does a minimal amount of processing
// dv.update.data tracks asynchronous data calls and calls dv.create.data after data is loaded  
dv.load.data = function() {
	dv.update.loadState(3);
	d3.csv(dv.opt.path.msa, function(error, data) {
		dv.data.msa = data;
		dv.update.loadState(-1);
	});
	d3.csv(dv.opt.path.links, function(error, data) {
		dv.data.links = data;
		dv.update.loadState(-1);
	});
	d3.json(dv.opt.path.statemap, function(data) {
		dv.data.states = data.features;
		dv.update.loadState(-1);
	});
};

// setup that has to be done after the data is loaded, called from dv.update.data
dv.process.data = function() {
	dv.create.index({data: dv.data.msa, indexName: 'msa', keyName: 'fips', col: 'FIPS'});
	dv.create.network();
	dv.create.scales();
	dv.create.paths();
	dv.draw.links();
	dv.draw.cities();
	dv.draw.labels();
};

/* CREATE: Create/manipulate data stuctures */

// get setup, load data, and take care of anything that can be done while the data is loading
dv.create.start = function() {
	dv.create.variables();
	dv.load.data();
	dv.draw.svg();
};

// calculates variables, especailly those based on the options and vice versa 
dv.create.variables = function() {
	dv.create.dims();
	dv.html.win.onresize = function() {
		dv.create.dims();
	};
	dv.opt.rose.arc = Math.PI / dv.opt.rose.petals;
};

dv.create.majorDistances = function() {
	var i, city;
	for (i = dv.data.msa.length - 1; i >= 0; i--) {
		city = dv.data.msa[i];
		console.log(city.City);
		dv.create.bigNearbyCities(city);
	}
};

dv.create.bigNearbyCities = function(origin) {
	//var i, i2, city, dist, length, nearby, candidate;
	var j=0,
		nearby, i, city, dist;
	dv.update.allDistances(origin.FIPS);
	nearby = dv.data.msa.slice(0);
	dv.util.aooSort({array: nearby, key: 'Population'});
	i = nearby.length - 1;
	while (j < 5 && i >= 0) {
		city = nearby[i];
		dist = dv.dato.dist[city.FIPS];
		if (dist <= dv.opt.city.near.max && dist >= dv.opt.city.near.min) {
			origin['nearFIPS'+j] = city.FIPS;
			origin['nearDist'+j] = dist;
			j++;
		}
		i--;
	}
};

dv.create.dims = function() {
	dv.html.win = window || document.documentElement || document.getElementsByTagName('body')[0];
	dv.dim.win = {
		w: dv.html.win.innerWidth || dv.html.win.clientWidth || dv.html.win.clientWidth,
		h: dv.html.win.innerHeight || dv.html.win.clientHeight || dv.html.win.clientHeight
	};
	dv.dim.win.min = dv.dim.win.w < dv.dim.win.h ? dv.dim.win.w : dv.dim.win.h;
	dv.scale.map = dv.dim.win.w * dv.opt.map.scale;
	dv.dim.svg = {
		w: dv.dim.win.w,
		h: dv.dim.win.w
	};
};

dv.create.network = function() {
	dv.dato.network = {};
	var i, link, distance,
		network = dv.dato.network;

	for (i = dv.data.links.length - 1; i >= 0; i--) {
		link = dv.data.links[i];
		network[link.c1fips] = network[link.c1fips] || {};
		network[link.c2fips] = network[link.c2fips] || {};
		distance = parseInt(link.dist, 10);
		network[link.c1fips][link.c2fips] = network[link.c1fips][link.c2fips] || {dist: distance};
		network[link.c2fips][link.c1fips] = network[link.c2fips][link.c1fips] || {dist: distance};
	}
	dv.calc.graph = new Graph(network);
};

// expects {data: someArray, indexName: 'indexName', col: 'someColName'}
dv.create.index = function(opt) {
	dv.dato[opt.indexName] = {};
	dv.keys[opt.keyName] = [];
	var i, row, value,
		col = opt.col,
		data = opt.data,
		index = dv.dato[opt.indexName],
		key = dv.keys[opt.keyName];

	for (i = data.length - 1; i >= 0; i--) {
		row = data[i];
		value = row[col];
		index[value] = row;
		key.push(value);
	}
};

dv.create.scales = function() {
	var scale = dv.scale.map,
		city = dv.opt.city,
		populationExtent = d3.extent(dv.data.msa, function(d){ return parseInt(d.Population, 10); });

	dv.scale.projection = d3.geo.albers()
		.scale(scale)
		.translate([scale / 2.7, scale / 3.5])
	;

	dv.path.shape = d3.geo.path()
		.projection(dv.scale.projection)
	;

	dv.scale.r = d3.scale.pow()
		.exponent(0.5)
		.domain(populationExtent)
		.rangeRound([city.radius.min, city.radius.max])
	;

	dv.scale.strokeW = d3.scale.pow()
		.exponent(0.5)
		.domain(populationExtent)
		.rangeRound([city.stroke.min, city.stroke.max])
	;

	dv.scale.font = d3.scale.pow()
		.exponent(0.5)
		.domain([city.popmin, populationExtent[1]])
		.rangeRound([city.font.min, city.font.max])
	;

	dv.scale.fill = d3.scale.quantize()
		.domain([5,0])
		.range(["#7f0000","#d7301f","#fc8d59","#4292c6","#08519c"])
		//.range(["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"])
		//.range(['#048','#ffeeee'])
	;

	dv.scale.round = function(num) {
		var grid = dv.opt.map.grid;
		return Math.round(num/grid) * grid;
	};

	dv.scale.x = d3.scale.linear()
		.domain([0,1])
		.range([0, dv.dim.svg.w])
	;

	dv.scale.y = d3.scale.linear()
		.domain([0,1])
		.range([0, dv.dim.svg.h])
	;

	dv.scale.xRound = function(num) {
		return dv.scale.round(dv.scale.x(num));
	};

	dv.scale.yRound = function(num) {
		return dv.scale.round(dv.scale.y(num));
	};

};

dv.create.paths = function() {
	dv.path.shape = d3.svg.line()
		.x(function(d) { return dv.scale.xRound(d.x); })
		.y(function(d) { return dv.scale.xRound(d.y); })
		.interpolate('cardinal-closed')
	;

	dv.path.arc = d3.svg.arc()
		.outerRadius(function(d) { return dv.scale.x(d); })
		.innerRadius(0)
		.startAngle(function(d, i) { return (2 * i * dv.opt.rose.arc) - dv.opt.rose.arc; })
		.endAngle(function(d, i) { return (2 * i * dv.opt.rose.arc) + dv.opt.rose.arc; })
	;
};

dv.create.rose = function(oFIPS) {
	var i, dist,
		length = dv.opt.rose.distances.length;
	dv.update.allDistances(oFIPS);
	dv.update.allAngles(oFIPS);
	for (i = 0; i < length; i++) {
		dist = dv.opt.rose.distances[i];
		dv.create.petals(dist, oFIPS);
	}
};

dv.create.petals = function(max, oFIPS) {
	var i, fips, time, city, petal, dist,
		origin = dv.dato.msa[oFIPS],
		rose = [];
	for (i = dv.opt.rose.petals - 1; i >= 0; i--) {
		rose[i] = 0;
	}
	for (i = dv.keys.fips.length - 1; i >= 0; i--) {
		fips = dv.keys.fips[i];
		time = dv.dato.time[fips];
		city = dv.dato.msa[fips];
		petal = dv.dato.petal[fips];
		if (time < max) {
			dist = dv.calc.xyDist(city, origin);
			if (!rose[petal] || dist > rose[petal]) {
				rose[petal] = dist;
			}
		}
	}
	dv.draw.rose(rose, origin);
};

dv.create.shapeOld = function(subset, oFIPS) {
	var i, i2, i3, i4, i5, c1, c2, c3, c4, c5, fips, city,
		origin = dv.dato.msa[oFIPS],
		NE = [],
		NW = [],
		SW = [],
		SE = [],
		shape = [];

	for (i = subset.length - 1; i >= 0; i--) {
		fips = subset[i];
		//cities[fips] = dv.dato.msa[fips];
		city = dv.dato.msa[fips];
		if (city.y >= origin.y) {
			if (city.x <= origin.x) { SW.push(city); } else { SE.push(city); }
		} else {
			if (city.x <= origin.x) { NW.push(city); } else { NE.push(city); }
		}
	}
	shape.NE = dv.util.aooSort({array: NE, key: 'x'});
	shape.SE = dv.util.aooSort({array: SE, key: 'x', reverse: true});
	shape.SW = dv.util.aooSort({array: SW, key: 'x', reverse: true});
	shape.NW = dv.util.aooSort({array: NW, key: 'x'});

	shape = NE.concat(SE,SW,NW);
	i = 0;
	while (i < shape.length && shape.length >= 3) {
		i2 = (i+1)%shape.length;
		i3 = (i+2)%shape.length;
		i4 = (i+3)%shape.length;
		i5 = (i+4)%shape.length;
		c1 = dv.calc.xyDist(shape[i], origin);
		c2 = dv.calc.xyDist(shape[i2], origin);
		c3 = dv.calc.xyDist(shape[i3], origin);
		c4 = dv.calc.xyDist(shape[i4], origin);
		c5 = dv.calc.xyDist(shape[i5], origin);
		if ( (c2 < c1 && c2 < c5) && (c3 < c1 && c3 < c5)  && (c4 < c1 && c4 < c5) ) {
			shape.splice(i2,3);
			if (i >= shape.length) { i = shape.length - 1; }
		} else if ( (c2 < c1 && c2 < c4) && (c3 < c1 && c3 < c4) ) {
			shape.splice(i2,2);
			if (i >= shape.length) { i = shape.length - 1; }
		} else if (c2 < c1 && c2 < c3) {
			shape.splice(i2,1);
			if (i >= shape.length) { i = shape.length - 1; }
		} else { i++; }
	}
	return shape;
};

dv.create.subset = function(min,max) {
	var i, time, subset = [];
	if (!dv.dato.time) { dv.update.allDistances(19740); }
	dv.data.fips = dv.data.fips || d3.keys(dv.dato.time);
	for (i = dv.data.fips.length - 1; i >= 0; i--) {
		time = dv.dato.time[dv.data.fips[i]];
		if (time > min && time <= max) {
			subset.push(dv.data.fips[i]);
		}
	}
	return subset;
};

/* WRITE: Write out html elements */

/* DRAW: Draw SVG elements for the first time */

dv.draw.svg = function() {
	dv.svg.main = d3.select('body').append('svg:svg')
		.attr('width', dv.dim.svg.w)
		.attr('height', dv.dim.svg.h)
		.append('svg:g')
	;
	dv.svg.map = dv.svg.main.append('svg:g')
		.attr('class', 'map')
		//.call(d3.behavior.zoom().on('zoom', this.zoom))
	;
};

dv.draw.shapes = function() {
	dv.data.shapes = [];
	dv.svg.shapes = dv.svg.map.append('svg:g')
		.selectAll('path')
		.data(dv.data.shapes)
		.enter().append('svg:path')
			.style('fill', '#048')
			.style('fill-opacity', 0.35)
	;
};

dv.draw.states = function() {
	dv.svg.states = dv.svg.map.append('svg:g')
		.attr('id', 'states')
		.selectAll('.state')
			.data(dv.data.states)
			.enter().append('svg:path')
				.attr('name', function(d) { return d.properties.name; })
				.attr('class', 'state')
				.attr('d', dv.path.shape)
	;
};

dv.draw.links = function() {
	dv.svg.links = dv.svg.map.append('svg:g')
		.attr('id', 'links')
		.selectAll('.link')
			.data(dv.data.links)
			.enter().append('svg:line')
				.attr('class', 'link')
				.attr('x1', function(d) { return dv.scale.xRound(dv.dato.msa[d.c1fips].x); })
				.attr('y1', function(d) { return dv.scale.yRound(dv.dato.msa[d.c1fips].y); })
				.attr('x2', function(d) { return dv.scale.xRound(dv.dato.msa[d.c2fips].x); })
				.attr('y2', function(d) { return dv.scale.yRound(dv.dato.msa[d.c2fips].y); })
	;
};

dv.draw.cities = function() {
	dv.svg.cities = dv.svg.map.append('svg:g')
		.attr('id', 'cities')
		.selectAll('.city')
			.data(dv.data.msa)
			.enter().append('svg:circle')
				.attr('class', 'city')
				.attr('r', function(d) { return dv.scale.r(d.Population); })
				.attr('cx', function(d) { return dv.scale.xRound(d.x); })
				.attr('cy', function(d) { return dv.scale.yRound(d.y); })
				.style('stroke-width', function(d) { return dv.scale.strokeW(d.Population); })
				.style('display', function(d) { if (!d.Highway || d.City === 'Junction') { return 'none'; } else { return false; } })
				//.style('display', function(d) { if (!d.Highway) { return 'none'; } else { return false; } })
				.on('mouseover', function(d) { dv.update.cityHover(event, d); })
				.on('mouseout', dv.hover.hide)
				//.on('click', function(d) { dv.create.rose(d.FIPS); })
				.on('click', function(d) { dv.update.fadeMap(d.FIPS); })
				//.call(dv.update.drag)
	;

};

dv.draw.labels = function() {
	dv.svg.labels = dv.svg.map.append('svg:g')
		.attr('id', 'labels')
		.selectAll('.label')
			.data(dv.data.msa)
			.enter().append('svg:text')
				.attr('class', 'label')
				.attr('dx', function(d) { return dv.scale.xRound(d.x) + dv.scale.r(d.Population) + dv.scale.strokeW(d.Population); })
				.attr('dy', function(d) { return dv.scale.yRound(d.y) - 2; })
				.style('display', function(d) { if (d.Population > dv.opt.city.popmin || d.State === 'Canada') { return false; } else { return 'none'; }})
				//.style('display', 'none')
				.style('font-size', function(d) { return dv.scale.font(d.Population); })
				.text(function(d) { return d.City; })
	;
};

dv.draw.rose = function(rose, origin) {
	dv.svg.rose = dv.svg.rose || [];
	dv.svg.rose[dv.svg.rose.length] = dv.svg.main.append('svg:g')
		.attr('transform', 'translate(' + dv.scale.xRound(origin.x) + ',' + dv.scale.yRound(origin.y) + ')')
		.attr('class','rose')
		.selectAll('path')
		.data(rose)
			.enter().append('svg:path')
			.attr('d', dv.path.arc)
	;
};


/* UPDATE: Update data, SVG, or HTML */

dv.update.shapes = function() {
	dv.svg.shapes.transition()
		.attr('d', dv.path.shape)
	;
};

dv.update.dragged = function(d) {
	var round = dv.scale.round,
		fips = d.FIPS,
		node = d3.select(this)
			.attr('cx', round(d3.event.x))
			.attr('cy', round(d3.event.y)),
		nodeX = round(node.attr('cx')),
		nodeY = round(node.attr('cy'));

	dv.svg.links
		.attr('x1', function(d) { if (d.c1fips === fips) { return nodeX; } else { return this.x1.animVal.value; } })
		.attr('y1', function(d) { if (d.c1fips === fips) { return nodeY; } else { return this.y1.animVal.value; } })
		.attr('x2', function(d) { if (d.c2fips === fips) { return nodeX; } else { return this.x2.animVal.value; } })
		.attr('y2', function(d) { if (d.c2fips === fips) { return nodeY; } else { return this.y2.animVal.value; } })
	;

	dv.svg.labels
		.attr('dx', function(d) { if (d.FIPS === fips) {  dv.temp = this; return nodeX + dv.scale.r(d.Population) + dv.scale.strokeW(d.Population); } else { return this.attributes[1].value; } })
		.attr('dy', function(d) { if (d.FIPS === fips) { return nodeY - 2; } else { return this.attributes[2].value; } })
	;
};

dv.update.dragend = function(d) {
	d.x = Math.round(dv.scale.x.invert(d3.select(this).attr('cx'))*250)/250;
	d.y = Math.round(dv.scale.y.invert(d3.select(this).attr('cy'))*250)/250;
};


dv.update.drag = d3.behavior.drag()
	.on('drag', dv.update.dragged)
	.on("dragend", dv.update.dragend);

// move the cities to their placed locations (subway map)
dv.update.cityToPlace = function() {
	var duration = 1000;
	dv.svg.cities.transition()
		.duration(duration)
		.attr('cx', function(d) { return dv.scale.xRound(d.x); })
		.attr('cy', function(d) { return dv.scale.yRound(d.y); })
	;
	dv.svg.labels.transition()
		.duration(duration)
		.attr('dx', function(d) { return dv.scale.xRound(d.x) + dv.scale.r(d.Population) + dv.scale.strokeW(d.Population); })
		.attr('dy', function(d) { return dv.scale.yRound(d.y) - 2; })
	;
	dv.svg.links.transition()
		.duration(duration)
		.attr('x1', function(d) { return dv.scale.xRound(dv.dato.msa[d.c1fips].x); })
		.attr('y1', function(d) { return dv.scale.yRound(dv.dato.msa[d.c1fips].y); })
		.attr('x2', function(d) { return dv.scale.xRound(dv.dato.msa[d.c2fips].x); })
		.attr('y2', function(d) { return dv.scale.yRound(dv.dato.msa[d.c2fips].y); })
	;
};

// move the cities to their actual lat/lng
dv.update.cityToGeo = function() {
	var duration = 1000;
	dv.svg.cities.transition()
		.duration(duration)
		.attr('cx', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[0]; })
		.attr('cy', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[1]; })
	;
	dv.svg.labels.transition()
		.duration(duration)
		.attr('dx', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[0] + dv.scale.r(d.Population) + dv.scale.strokeW(d.Population); })
		.attr('dy', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[1] - 2; })
	;
	dv.svg.links.transition()
		.duration(duration)
		.attr('x1', function(d) { return dv.scale.projection([d.c1geoLng, d.c1geoLat])[0]; })
		.attr('y1', function(d) { return dv.scale.projection([d.c1geoLng, d.c1geoLat])[1]; })
		.attr('x2', function(d) { return dv.scale.projection([d.c2geoLng, d.c2geoLat])[0]; })
		.attr('y2', function(d) { return dv.scale.projection([d.c2geoLng, d.c2geoLat])[1]; })
	;
};

// populate the hover with information about the city
dv.update.cityHover = function(event, d) {
	var html = '<h5>' + d.City + ', ' + d.State + '</h5><ul>',
		city, dist;

	//html += '<li><strong>Population: </strong>' + dv.format.number(d.Population) + '</li>';
	//html += '<li><strong>FIPS: </strong>' + d.FIPS + '</li>';
/*	if (dv.dato.dist) {
		html += '<li><strong>Distance: </strong>' + dv.format.dist(dv.dato.dist[d.FIPS]) + '</li>';
	}
*/	if (dv.dato.time) {
		html += '<li><strong>Time: </strong>' + dv.format.time(dv.dato.time[d.FIPS]) + '</li>';
	}
	for (var i=0;i<5;i++) {
		city = 'nearFIPS' + i;
		dist = 'nearDist' + i;
		html += '<li><strong>' + dv.dato.msa[d[city]].City + ': </strong>' + dv.format.time(dv.calc.time(d[dist])) + '</li>';
	}
	if (dv.dato.angle) {
		html += '<li><strong>Angle: </strong>' + dv.dato.angle[d.FIPS] + ' degrees</li>';
	}
	if (dv.dato.petal) {
		html += '<li><strong>Petal: </strong>' + dv.dato.petal[d.FIPS] + '</li>';
	}
	html += '</ul>';
	dv.hover.show(event, html);
};

// find the distance from an origin (fips) and every other city on the map
dv.update.allDistances = function(oFIPS) {
	var i, fips, array,
		extremes = [99991,99992,99994,20260,24580,13020,99995,99996,12620,39300,35620,47900,47260,27340,34820,16700,33100,27260,15180,88886,88883,41740,42220,14740];

	dv.dato.dist = {};
	dv.dato.time = {};
	dv.dato.dist[oFIPS] = 0;
	dv.dato.time[oFIPS] = 0;

	function checkFIPS(fips) {
		if (!dv.dato.time[fips]) {
			array = dv.calc.graph.findShortestPath(oFIPS, fips);
			dv.update.allTimes(array);
		}
	}

	for (i = extremes.length - 1; i >= 0; i--) {
		fips = extremes[i];
		checkFIPS(fips);
	}

	for (i = dv.data.msa.length - 1; i >= 0; i--) {
		fips = dv.data.msa[i].FIPS;
		checkFIPS(fips);
	}
};

dv.update.allAngles = function(oFIPS) {
	var i, city, petal, angle,
		petals = dv.opt.rose.petals,
		arc = dv.opt.rose.arc,
		origin = dv.dato.msa[oFIPS];
	dv.dato.angle = {};
	dv.dato.petal = {};

	for (i = dv.data.msa.length - 1; i >= 0; i--) {
		city = dv.data.msa[i];
		angle = dv.util.getRad(origin.x, origin.y, city.x, city.y);
		dv.dato.angle[city.FIPS] = Math.round(angle * 180 / Math.PI);

		// This shifts the petals 45deg to the right so that a petal consists of the cities on either side of a given angle
		petal = Math.floor(angle / arc);
		petal = (petal + 1) % (petals * 2);
		petal = Math.floor(petal / 2);
		dv.dato.petal[city.FIPS] = petal;
	}
};



dv.update.fadeMap = function(oFIPS) {
	dv.update.allDistances(oFIPS);
	dv.svg.cities
		.style('fill', function(d) {
			if (d.City !== 'Junction') {
				return dv.scale.fill(dv.dato.time[d.FIPS]);
			} else { return false; }
		})
		.style('stroke', '#FFF')
		.style('stroke-width', 2)
	;
	dv.svg.links
		.style('stroke', function(d) {
			return dv.scale.fill(dv.dato.time[d.c1fips]);
		})
	;
};

// updates the travel time between the origin city and every city along the a path (array)
dv.update.allTimes = function(array) {
	var i, fips1, fips2,
		distance = 0,
		length = array.length;

	for (i = 1; i < length; i++) {
		fips1 = array[i];
		fips2 = array[i-1];
		distance += dv.dato.network[fips1][fips2].dist;
		dv.dato.dist[fips1] = distance;
		dv.dato.time[fips1] = dv.dato.time[fips1] || dv.calc.time(distance);
	}
};


/* CALC: Calculate something and return a value */

// finds the shortest distance between two cities on the network and returns the distance
dv.calc.distance = function(a,b) {
	var i, fips1, fips2,
		distance = 0,
		array = dv.calc.graph.findShortestPath(a,b);

	for (i = array.length - 1; i > 0; i--) {
		fips1 = array[i];
		fips2 = array[i-1];
		distance += dv.dato.network[fips1][fips2].dist;
	}
	return distance;
};

// Let's make this equation a bit more robust at some point
// parameterize the options and actually do some math
dv.calc.time = function(meters) {
	/*	Formula for total time:
	T = total time in hours
	D = total distance in miles
	T = (D - 65.4mi)/760mph + 0.214hr
	*/
	var dist = meters/1610,
		time = 0,
		safeSpeed = 300,
		topSpeed = 760,
		distToSafe = 1.1 * 2,
		distAtSafe = 28.1 * 2,
		distToTop = 2.7 * 2;

	if (dist > distToSafe) {
		time += distToSafe / (safeSpeed / 2);
		dist -= distToSafe;
	} else {
		time += dist / (safeSpeed / 2);
		dist = 0;
	}

	if (dist > distAtSafe) {
		time += distAtSafe / safeSpeed;
		dist -= distToSafe;
	} else {
		time += dist / safeSpeed;
		dist = 0;
	}

	if (dist > distToTop) {
		time += distToTop / (topSpeed / 2);
		dist -= distToSafe;
	} else {
		time += dist / (topSpeed / 2);
		dist = 0;
	}

	if (dist > 0) {
		time += dist / topSpeed;
	}

	return time;
};

// calculates the pixel distance between two cities on the map
dv.calc.xyDist = function(c1, c2) {
	return Math.sqrt(Math.pow((c1.x - c2.x),2) + Math.pow((c1.y - c2.y),2));
};


/* FORMAT: Take a value and return something that can be displayed  */

// meters to miles
dv.format.dist = function(meters) {
	return Math.round(meters/1610*10)/10 + ' miles';
};

// fractional hours to hhours mminutes sseconds
dv.format.time = function(hours) {
	var seconds, minutes, string = '';
	seconds = hours * 3600;
	hours = Math.floor(seconds/3600);
	seconds -= hours * 3600;
	minutes = Math.floor(seconds / 60);
	seconds -= minutes * 60;
	seconds = Math.round(seconds%60, 10);

	function checkS(num) {
		if (num > 1 || num === 0) { return 's'; } else { return ''; }
	}
	if (hours > 0) { string = hours + ' hour' + checkS(hours) + ' '; }
	if (minutes > 0) { string +=  minutes + ' minute' + checkS(minutes); }
	return string;
};

// Make numbers human readable
// Takes a number as an input (num), returns a string
dv.format.number = function(num) {
	var factor = 1;
	var abbvr = "";
	if (num < 999) { return 0; }
	//else if (num < 999999) { factor = 100; abbvr = "K"; }
	else if (num < 999999999) { factor = 100000; abbvr = "M"; }
	else if (num < 999999999999) { factor = 100000000; abbvr =  "B"; }
	else if (num < 999999999999999) { factor = 100000000000; abbvr =  "T"; }
	num = Math.round(num/factor)/10 + abbvr;
	return num;
};


/* REUSABLE functions */

// handles multiple streams of asynchronous requests for data, kicks off a corresponding dv.process[streamName]() when the data is all loaded
dv.update.loadState = function(change, name) {
	name = name || 'data';
	change = change || 1;
	dv.state[name] = dv.state[name] || 0;
	dv.state[name] += change;
	if (dv.state[name] === 0) { dv.process[name](); }
};

// takes an object, converts it to a json string, and writes it out to the dom in a div with id 'console'
dv.util.objToJSON = function(obj) {
	var string = JSON.stringify(obj);
	dv.util.consoleToBody(string);
};

// sort an array of objects by a given key
// expects {array: someArray, key: anObjectKey, reverse: false} 
dv.util.aooSort = function(o) {
	o.array.sort(function(a, b) {
		if (o.reverse) {
			return b[o.key] - a[o.key];
		} else {
			return a[o.key] - b[o.key];
		}
	});
	return o.array;
};

// the angle in radians between two points relative to the first point, returns a positive number between 0 (3 o'clock)
dv.util.getRad = function(x1,y1,x2,y2) {
	var rad = x2 - x1 === 0 ? Math.PI / 2 : Math.atan((y1 - y2)/(x1 - x2));
	if (x2 - x1 === 0 && y2 - y1 < 0) {
		rad = 0;
	} else if (x2 - x1 < 0) {
		rad = 1.5 * Math.PI + rad;
	} else {
		rad = Math.PI / 2 + rad;
	}
	return rad;
};


// takes an array of objects, converts it to a string, and writes it out to the dom in a div with id 'console'
dv.util.aooToCSV = function(obj) {
	var i = 0,
		j = 0,
		len = obj.length,
		len2 = 0,
		row = {},
		cols = d3.keys(obj[0]),
		col = '',
		csv = '';

	for (i = 0; i < len; i++) {
		if (csv === '') {
			len2 = cols.length;
			for (j = 0; j < len2; j++) {
				col = cols[j];
				csv += '"' + col + '"';
				if (j < len2 - 1) { csv += ','; }
			}
			csv +='</br>';
		}
		row = obj[i];
		len2 = cols.length;
		for (j = 0; j < len2; j++) {
			col = cols[j];
			csv += '"' + row[col] + '"';
			if (j < len2 - 1) { csv += ','; }
		}
		csv +='</br>';
	}
	dv.util.consoleToBody(csv);
};

// writes a string out to a div with id 'console'
dv.util.consoleToBody = function(string) {
	if (!dv.html.console) {
		dv.html.console = d3.select('body').append('div').attr('id','console');
	}
	dv.html.console.html(string);
};

// specialized console function for checking more complex structures
dv.util.console = function() {
};

// creates a hover that can be called by dv.util.hover(event, html), if no event or html is provided, hover is hidden
dv.hover = dv.hover || {};
dv.hover.show = function(event, html) {
	if (!dv.html.hover) { dv.hover.create(); }
	var x, y, hover, height, width,
		dim = dv.dim.win,
		win = dv.html.win,
		scroll = { x: win.scrollX, y: win.scrollY },
		opt = dv.opt.hover || {},
		margin = opt.margin || 10,
		offset = opt.offset || 10;

	if (event && html) {
		x = event.clientX + offset;
		y = event.clientY - offset;

		hover = document.getElementById('hover');
		dv.html.hover.html(html);
		height = hover.offsetHeight;
		width = hover.offsetWidth;
		if (x + width + margin >= dim.w) { x = x - 2 * offset - width; x = x < scroll.x ? margin : x; }
		if (y + height + margin >= dim.h) { y = dim.h - margin - height; y = y < scroll.y ? dim.h - height - margin : y; }
		x += scroll.x;
		y += scroll.y;
		dv.html.hover.style('top', y + 'px').style('left', x + 'px').style('visibility','visible');
	}
};
dv.hover.create = function() {
	dv.html.hover = d3.select('body').append('div')
		.attr('id', 'hover')
		.style('display', 'block')
		.attr('visibility', 'hidden');
};
dv.hover.hide = function() {
	if (dv.html.hover) { dv.html.hover.style('visibility','hidden'); }
};

dv.create.start();

/*


Notes
GDP and Population data sourced from 
Bureau of Economic Analysis
http://www.bea.gov/iTable/iTable.cfm?ReqID=9&step=1#reqid=9&step=1&isuri=1

* Hanford MSA (25260) combined with Visalia (47300)
* Visalia: Population: 449254
* Hanford: Population: 153767
* Combined:	Population: 603021

* Butte-Helena, MT
* Source: Wikipedia
* Helena - FIPS: 30-35600	Population: 76277
* Butte - FIPS: 30-11397	Population: 33525
* Combined: Population: 109802


* Cities Added
* Source: Wikipedia
37775	Lake City, FL	67531
99996	Montreal, Canada	3824221
99995	Toronto, Canada	5583064
99994	Winnipeg, Canada	730018
99993	Calgary, Canada	1214839
99992	Edmonton, Canada	1159869
99991	Vancouver, Canada	2313328

Latitude and Longitude data from Google Geocoding API
https://developers.google.com/maps/documentation/geocoding/

Distance and travel times from Google Distance Matrix API
https://developers.google.com/maps/documentation/distancematrix/

*/
