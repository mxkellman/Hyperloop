/*

Bugs


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
/* global google */
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
// calculates variables, especailly those based on the options and vice versa 
dv.setup.variables = function() {
	dv.opt = {
		path: {
			msa: 'data/MSA.csv',
			links: 'data/Links.csv'
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
			scale: 1.34
		}
	};
	dv.setup.dims();
	dv.html.win.onresize = function() {
		dv.setup.dims();
	};
};

// specialized console function for checking more complex structures
dv.console = function() {
};

// retrieves the data from files and does a minimal amount of processing
// dv.update.load tracks asynchronous data calls and calls dv.setup.withData after data is loaded  
dv.get.data = function() {
	dv.update.load(3);
	d3.csv(dv.opt.path.msa, function(error, data) {
		dv.data.msa = data;
		dv.update.load(-1);
	});
	d3.csv(dv.opt.path.links, function(error, data) {
		dv.data.links = data;
		dv.update.load(-1);
	});
	d3.json('data/us-states.json', function(json) {
		dv.data.states = json.features;
		dv.update.load(-1);
	});
};


// calls dv.setup.withData() once all of the data has been loaded
dv.update.load = function(change) {
	dv.state.load = dv.state.load || 0;
	dv.state.load += change;
	if (dv.state.load === 0) { dv.setup.withData(); }
};

// any setup that can be done before/while the data is being processed
dv.setup.withoutData = function() {
	dv.setup.variables();
	dv.get.data();
};

// setup that has to be done after the data is loaded, called from dv.update.load
dv.setup.withData = function() {
	dv.sort.cities({data: dv.data.msa, indexName: 'msa', col: dv.opt.cities.col, reverse: true});
	dv.create.highways();
	dv.create.network();
	dv.create.scales();
	dv.draw.svg();
	dv.draw.states();
	dv.draw.cities();
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

// go through each highway, get each city, and create a link to its nearest neighbor, {source: index, target: index}
// in that same function, add to the dijkstra array: {fips: {fips: true, fips: true, etc...}, fips: {fips:true}}  if (!dij.source.target) { dij.source.target = true;} if (!dij.target.source) {dij.target.source = true;}
dv.create.links = function() {
	dv.data.links = [];
	dv.index.network = {};
	var highways = dv.data.highways,
		hwyIndex = dv.index.highways,
		msa = dv.index.msa,
		links = dv.data.links,
		c1 = {},
		c2 = {},
		i, j, hwyNumber, highway;

	for (i = hwyIndex.length - 1; i >= 0; i--) {
		hwyNumber = hwyIndex[i];
		highway = highways[hwyNumber];
		for (j = highway.length - 1; j >= 1; j--) {
			c1.fips = highway[j];
			c1.msa = msa[c1.fips];
			c1.geoLat = c1.msa.geoLat;
			c1.geoLng = c1.msa.geoLng;
			c2.fips = highway[j-1];
			c2.msa = msa[c2.fips];
			c2.geoLat = c2.msa.geoLat;
			c2.geoLng = c2.msa.geoLng;
			links.push({c1fips: c1.fips, c1geoLat: c1.geoLat, c1geoLng: c1.geoLng, c2fips: c2.fips, c2geoLat: c2.geoLat, c2geoLng: c2.geoLng, Highway: hwyNumber});
		}
	}
	dv.create.network();
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

// expects {data: someArray, indexName: 'indexName', col: 'someColName', reverse: false}
// used to sort and index the list of major cities
dv.sort.cities = function(opt) {
	dv.index[opt.indexName] = {};
	var col = opt.col,
		data = opt.data,
		index = dv.index[opt.indexName],
		i, fips, city;
	data.sort(function(a, b) {
		if (opt.reverse) {
			return a[col] - b[col];
		} else {
			return b[col] - a[col];
		}
	});
	for (i = data.length - 1; i >= 0; i--) {
		city = data[i];
		fips = city.FIPS;
		city.index = i;
		index[fips] = city;
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

	dv.scale.stroke = d3.scale.pow()
		.exponent(0.5)
		.domain(populationExtent)
		.rangeRound([city.stroke.min, city.stroke.max])
	;

	dv.scale.font = d3.scale.pow()
		.exponent(0.5)
		.domain([city.popmin, populationExtent[1]])
		.rangeRound([city.font.min, city.font.max])
	;
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
	dv.svg.links = dv.svg.map.append('svg:g')
		.attr('id', 'links')
		.selectAll('.link')
			.data(dv.data.links)
			.enter().append('svg:line')
				.attr('class', 'link')
				.attr('x1', function(d) { return dv.scale.projection([d.c1geoLng, d.c1geoLat])[0]; })
				.attr('y1', function(d) { return dv.scale.projection([d.c1geoLng, d.c1geoLat])[1]; })
				.attr('x2', function(d) { return dv.scale.projection([d.c2geoLng, d.c2geoLat])[0]; })
				.attr('y2', function(d) { return dv.scale.projection([d.c2geoLng, d.c2geoLat])[1]; })
	;

	dv.svg.cities = dv.svg.map.append('svg:g')
		.attr('id', 'cities')
		.selectAll('.city')
			.data(dv.data.msa)
			.enter().append('svg:circle')
				.attr('class', 'city')
				.attr('r', function(d) { return dv.scale.r(d.Population); })
				.attr('cx', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[0]; })
				.attr('cy', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[1]; })
				.style('fill', function(d) { if (dv.scale.stroke(d.Population) === 0) { return '#900'; } else { return false; } })
				.style('stroke-width', function(d) { return dv.scale.stroke(d.Population); })
				.style('display', function(d) { if (!d.Highway || d.City === 'Junction') { return 'none'; } else { return false; } })
				//.style('display', function(d) { if (!d.Highway) { return 'none'; } else { return false; } })
				.on('mouseover', function(d) { dv.update.showCityHover(event, d); })
				.on('mouseout', dv.hover.hide)
	;

	dv.svg.labels = dv.svg.map.append('svg:g')
		.attr('id', 'labels')
		.selectAll('.label')
			.data(dv.data.msa)
			.enter().append('svg:text')
				.attr('class', 'label')
				.attr('dx', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[0] + dv.scale.r(d.Population) + dv.scale.stroke(d.Population); })
				.attr('dy', function(d) { return dv.scale.projection([d.geoLng, d.geoLat])[1] - 2; })
				.style('display', function(d) { if (d.Population > dv.opt.city.popmin) { return false; } else { return 'none'; }})
				//.style('display', 'none')
				.style('font-size', function(d) { return dv.scale.font(d.Population); })
				.text(function(d) { return d.City; })
	;
};

dv.update.showCityHover = function(event, d) {
	var html = '<h5>' + d.City + ', ' + d.State + '</h5><ul>';
	html += '<li><strong>Population: </strong>' + d.Population + '</li>';
	html += '<li><strong>Highway(s): </strong>' + d.Highway + '</li>';
	html += '<li><strong>FIPS: </strong>' + d.FIPS + '</li>';
	html += '</ul>';
	dv.hover.show(event, html);
};

dv.calc.distance = function(a,b) {
	var i, fips1, fips2,
		distance = 0,
		array = dv.calc.graph.findShortestPath(a,b),
		network = dv.index.network;

	for (i = array.length - 1; i > 0; i--) {
		fips1 = array[i];
		fips2 = array[i-1];
		distance += network[fips1][fips2].dist;
	}
	return distance;
};

// deprecated once cities were finalized (moved to highways.json) 
// these functions were used to create the highway system from the list of cities
// parses the highways column, adds cities to dv.data.highways in the order the appear on the highway
dv.create.highways = function() {
	dv.data.highways = {};
	var i, city, cityHwy, fips, hwyNumber, hwyArr, hwyCities, j,
		hwyData = dv.data.highways,
		msa = dv.data.msa,
		msaIndex = dv.index.msa,
		hwyKeys = [];
	for (i = msa.length - 1; i >= 0; i--) {
		city = msa[i];
		if (city.Highway) {
			cityHwy = city.Highway.split(',');
			for (j = cityHwy.length - 1; j >= 0; j--) {
				hwyNumber = cityHwy[j];
				if (!hwyData[hwyNumber]) {
					hwyData[hwyNumber] = [];
				}
				hwyData[hwyNumber].push(city.FIPS);
			}
		}
	}
	dv.index.highways = d3.keys(hwyData);
	hwyKeys = dv.index.highways;
	for (i = hwyKeys.length - 1; i >= 0; i--) {
		hwyNumber = hwyKeys[i];
		hwyArr = hwyData[hwyNumber];
		hwyCities = [];
		for (j = hwyArr.length - 1; j >= 0; j--) {
			fips = hwyArr[j];
			city = msaIndex[fips];
			hwyCities.push(city.FIPS);
		}
		hwyCities = dv.sort.highway(hwyNumber, hwyCities);
		hwyData[hwyNumber] = hwyCities;
	}
};

// sorts the cities along a highway from north/south or east/west depending on the highway number 
dv.sort.highway = function(hwyNumber, hwyCities) {
	var msa = dv.index.msa;
	if (hwyNumber%2 === 0) {
		hwyCities.sort(function(a, b) {
			return msa[b].geoLng - msa[a].geoLng;
		});
	} else {
		hwyCities.sort(function(a, b) {
			return msa[b].geoLat - msa[a].geoLat;
		});
	}
	return hwyCities;
};



// these functions were all used to get the distance between each adjacent node
dv.update.dist = function(change) {
	dv.state.dist = dv.state.dist || 0;
	dv.state.dist += change;
	if (dv.state.dist === 0) {
		dv.util.aooToCSV(dv.data.links);
	}
};

dv.get.dist = function() {
	var timer, link, origin, destination, answer,
		i = 0,
		links = dv.data.links,
		length = links.length,
		service = new google.maps.DistanceMatrixService();

	dv.update.dist(1);
	timer = setInterval(function() {
		dv.update.dist(1);
		getDist(i);
		i++;
		if (i >= length) {
			dv.update.dist(-1);
			clearInterval(timer);
		}
	}, 2000);

	function getDist(i) {
		link = links[i];
		origin = new google.maps.LatLng(link.c1geoLat, link.c1geoLng);
		destination = new google.maps.LatLng(link.c2geoLat, link.c2geoLng);
		service.getDistanceMatrix(
			{
				origins: [origin],
				destinations: [destination],
				travelMode: google.maps.TravelMode.DRIVING
			}, function(results, status) {
				if (status === google.maps.DistanceMatrixStatus.OK) {
					answer = results.rows[0].elements[0];
					links[i].drivetime = answer.duration.value;
					links[i].dist = answer.distance.value;
					console.log(i);
				} else { console.log("Fail: " + status); }
				dv.update.dist(-1);
			}
		);
	}
};

// these functions were all used to generate lat and lng values for each city
dv.update.latlng = function(change) {
	dv.state.latlng = dv.state.latlng || 0;
	dv.state.latlng += change;
	if (dv.state.latlng === 0) {
		dv.util.aooToCSV(dv.data.msa);
	}
};

dv.get.latlng = function() {
	var length, timer,
		i = 0,
		city = {},
		address = '',
		loc = {},
		service = google.maps.Geocoder ? new google.maps.Geocoder() : function() { console.log('Google services not loaded.'); };

	d3.csv(dv.opt.path.raw, function(error, data) {
		length = data.length;
		dv.data.raw = data;
		timer = setInterval(function() {
			while (i < length && dv.data.raw[i].geoLat !== 'undefined') {
				i++;
			}
			if (i < length) {
				dv.update.latlng(1);
				getLatLng(i);
				i++;
			} else {
				clearInterval(timer);
			}
		}, 1500);

		function getLatLng(i) {
			city = dv.data.msa[i];
			address = city.City + ', ' + city.State;
			service.geocode({'address': address}, function(results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					loc = results[0].geometry.location;
					dv.data.raw[i].geoLat = loc.lat();
					dv.data.raw[i].geoLng = loc.lng();
				} else { console.log("Fail: " + status); }
				dv.update.latlng(-1);
			});
		}
	});
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
		if (x + width + margin >= dim.w) { console.log('slipped'); x = x - 2 * offset - width; x = x < scroll.x ? margin : x; }
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

dv.setup.withoutData();
