/*

Bugs
* Need intersection between Raleigh and Greenville, Rocky Mt and Fayettville

Small Enhancements


Medium Enhancements


Large Enhancements


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

/* global d3 */
// /* global google */
/* global Graph */

/* jshint devel:true */

// dv is the namespace used to avoid collisions with other code or libraries
// all static variables and object placeholders

var dv = {
	create: {},
	calc: {},
	data: {},
	dim: {},
	draw: {},
	html: {},
	format: {},
	force: {},
	get: {},
	index: {},
	scale: {},
	setup: {},
	sort: {},
	state: {},
	svg: {},
	update: {},
	util: {},
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
	},
	map: {
		scale: 1.34,
		grid: 5
	}
};

// calculates variables, especailly those based on the options and vice versa 
dv.setup.variables = function() {
	dv.setup.dims();
	dv.html.win.onresize = function() {
		dv.setup.dims();
	};
};

dv.setup.dims = function() {
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

// setup that has to be done after the data is loaded, called from dv.update.data
dv.setup.data = function() {
	dv.create.index({data: dv.data.msa, indexName: 'msa', col: 'FIPS'});
	dv.create.network();
	dv.create.scales();
	dv.draw.svg();
	dv.draw.cities();
};

// any setup that can be done before/while the data is being processed
dv.setup.preData = function() {
	dv.setup.variables();
	dv.get.data();
};

// retrieves the data from files and does a minimal amount of processing
// dv.update.data tracks asynchronous data calls and calls dv.setup.data after data is loaded  
dv.get.data = function() {
	dv.update.data(3);
	d3.csv(dv.opt.path.msa, function(error, data) {
		dv.data.msa = data;
		dv.update.data(-1);
	});
	d3.csv(dv.opt.path.links, function(error, data) {
		dv.data.links = data;
		dv.update.data(-1);
	});
	d3.json(dv.opt.path.statemap, function(data) {
		dv.data.states = data.features;
		dv.update.data(-1);
	});
};

// calls dv.setup.data() once all of the data has been loaded
dv.update.data = function(change) {
	dv.state.load = dv.state.load || 0;
	dv.state.load += change;
	if (dv.state.load === 0) { dv.setup.data(); }
};

dv.create.network = function() {
	dv.index.network = {};
	var i, link, distance,
		network = dv.index.network;

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
	dv.index[opt.name] = {};
	dv.index[opt.indexName] = {};
	var i, row, value,
		col = opt.col,
		data = opt.data,
		index = dv.index[opt.indexName];

	for (i = data.length - 1; i >= 0; i--) {
		row = data[i];
		value = row[col];
		index[value] = row;
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

	dv.scale.path = d3.geo.path()
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

	dv.scale.fill = d3.scale.linear()
		.domain([0,5])
		.range(['#900','#FFF'])
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

dv.draw.states = function() {
	dv.svg.states = dv.svg.map.append('svg:g')
		.attr('id', 'states')
		.selectAll('.state')
			.data(dv.data.states)
			.enter().append('svg:path')
				.attr('name', function(d) { return d.properties.name; })
				.attr('class', 'state')
				.attr('d', dv.scale.path)
	;
};

dv.draw.cities = function() {
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

	dv.ghost = {};

	dv.svg.links = dv.svg.map.append('svg:g')
		.attr('id', 'links')
		.selectAll('.link')
			.data(dv.data.links)
			.enter().append('svg:line')
				.attr('class', 'link')
				.attr('x1', function(d) { return dv.scale.xRound(dv.index.msa[d.c1fips].x); })
				.attr('y1', function(d) { return dv.scale.yRound(dv.index.msa[d.c1fips].y); })
				.attr('x2', function(d) { return dv.scale.xRound(dv.index.msa[d.c2fips].x); })
				.attr('y2', function(d) { return dv.scale.yRound(dv.index.msa[d.c2fips].y); })
	;

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
				.on('click', dv.update.allDistances)
				.call(dv.update.drag)
	;

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
		.attr('x1', function(d) { return dv.scale.xRound(dv.index.msa[d.c1fips].x); })
		.attr('y1', function(d) { return dv.scale.yRound(dv.index.msa[d.c1fips].y); })
		.attr('x2', function(d) { return dv.scale.xRound(dv.index.msa[d.c2fips].x); })
		.attr('y2', function(d) { return dv.scale.yRound(dv.index.msa[d.c2fips].y); })
	;
};

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

dv.update.cityHover = function(event, d) {
	var html = '<h5>' + d.City + ', ' + d.State + '</h5><ul>';
	html += '<li><strong>Population: </strong>' + d.Population + '</li>';
	html += '<li><strong>Highway(s): </strong>' + d.Highway + '</li>';
	html += '<li><strong>FIPS: </strong>' + d.FIPS + '</li>';
	html += '</ul>';
	dv.hover.show(event, html);
};

dv.update.allDistances = function(origin) {
	var i, fips, array,
		extremes = [99991,99992,99994,20260,24580,13020,99995,99996,12620,39300,35620,47900,47260,27340,34820,16700,33100,27260,15180,88886,88883,41740,42220,14740];

	dv.index.time = {};
	dv.index.time[origin.FIPS] = 0;

	function checkFIPS(fips) {
		if (!dv.index.time[fips]) {
			array = dv.calc.graph.findShortestPath(origin.FIPS, fips);
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

	dv.svg.cities
		.style('fill', function(d) {
			if (d.City !== 'Junction') {
				return dv.scale.fill(dv.index.time[d.FIPS]);
			} else { return false; }
		})
		.style('stroke', function() {
/*			if (d.City !== 'Junction') {
				return dv.scale.fill(dv.index.time[d.FIPS]);
			} else { return false; }
*/			return "#FFF";
		})
		.style('stroke-width', 2)
	;
};

dv.update.allTimes = function(array) {
	var i, fips1, fips2,
		distance = 0,
		length = array.length;

	for (i = 1; i < length; i++) {
		fips1 = array[i];
		fips2 = array[i-1];
		distance += dv.index.network[fips1][fips2].dist;
		dv.index.time[fips1] = dv.index.time[fips1] || dv.calc.time(distance);
	}
};

dv.calc.distance = function(a,b) {
	var i, fips1, fips2,
		distance = 0,
		array = dv.calc.graph.findShortestPath(a,b);

	for (i = array.length - 1; i > 0; i--) {
		fips1 = array[i];
		fips2 = array[i-1];
		distance += dv.index.network[fips1][fips2].dist;
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

dv.format.distance = function(meters) {
	return Math.round(meters/1610*10)/10 + ' miles';
};

// expects time in hours
dv.format.time = function(time) {
	var seconds, hours, minutes;
	seconds = time * 3600;
	hours = Math.floor(seconds/3600);
	seconds -= hours * 3600;
	minutes = Math.floor(seconds / 60);
	seconds -= minutes * 60;
	seconds = Math.round(seconds%60, 10);

	function checkS(num) {
		if (num > 1 || num === 0) { return 's'; } else { return ''; }
	}

	return hours + ' hour' + checkS(hours) + ' ' + minutes + ' minute' + checkS(minutes) + ' and ' + seconds + ' second' + checkS(seconds);
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

// takes an object, converts it to a json string, and writes it out to the dom in a div with id 'console'
dv.util.objToJSON = function(obj) {
	var string = JSON.stringify(obj);
	dv.util.consoleToBody(string);
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

dv.setup.preData();
