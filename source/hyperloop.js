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



* Need intersection at 222 and 76 Lancaster-Reading and Harrisburg-Philadelphia (PA)

Latitude and Longitude data from Google Geocoding API
https://developers.google.com/maps/documentation/geocoding/

Distance and travel times from Google Distance Matrix API
https://developers.google.com/maps/documentation/distancematrix/

data.msa = [{
	FIPS: 35620,
	FullMSAName: "New York-Northern New Jersey-Long Island, NY-NJ-PA",
	GDP: 1123460,
	GDPPerCapita: 59080,
	Population: 19015911,
	MSACity: "New York-Northern New Jersey-Long Island",
	MSAState: "NY-NJ-PA",
	City: "New York",
	State: "NY",
	geoLat: number,
	geoLng: number,
}]

data.graph = {
	msa: {
		msa: number,
	}
}

data.pairs = [
  { source: "Denver, CO",
    target: "Salt Lake City, UT",
    distance: 12345,
    drive time: { hours: 8, minutes: 45 }
  }, 
  { source: "Reno, NV", target ... }
]

data.graph = {
  "Denver, CO":
    { "Salt Lake City, UT": 12345,
      "Cheyenne, WY": 123
      "Kansas City, MO": 1234 },
  "Salt Lake City, UT": 
    { "Denver, CO": 12345, … }
}      

*/

/* global d3 */
/* global google */

/* jshint devel:true */

// dv is the namespace used to avoid collisions with other code or libraries
// all static variables and object placeholders

var dv = {
	create: {},
	data: {},
	dim: {},
	draw: {},
	format: {},
/*
	Uncomment the script tag in html and then this when you need the google API
	geo: new google.maps.Geocoder(),
*/
	force: {},
	get: {},
	index: {},
	scale: {},
	setup: {},
	sort: {},
	state: { loading: 0	},
	svg: {},
	update: {},
	util: {},
};

// dv.opt stores all options that can be changed "on the fly"
// calculates variables, especailly those based on the options and vice versa 
dv.setup.variables = function() {
	dv.opt = {
		path: {
			raw: 'data/MSARaw.csv',
			data: 'data/MSA.csv'
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
		}
	};
	dv.dim.win = {
		w: window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth,
		h: window.innerHeight || document.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight
	};
	dv.dim.win.min = dv.dim.win.w < dv.dim.win.h ? dv.dim.win.w : dv.dim.win.h;
	dv.scale.map = dv.dim.win.w * 1.34;
	dv.dim.svg = {
		w: dv.dim.win.w,
		h: dv.dim.win.w
	};

	dv.console = function() {
	};
};

// calls dv.setup.withData() once all of the data has been loaded
dv.update.loading = function(change) {
	dv.state.loading += change;
	if (dv.state.loading === 0) { dv.setup.withData(); }
};

// any setup that can be done before/while the data is being processed
dv.setup.withoutData = function() {
	dv.setup.variables();
	dv.get.data();
};

// setup that has to be done after the data is loaded, called from dv.update.loading
dv.setup.withData = function() {
	dv.sort.cities({data: dv.data.msa, indexName: 'msa', col: dv.opt.cities.col, reverse: true});
	dv.create.highways();
	dv.create.links();
	dv.create.scales();
	dv.draw.svg();
	dv.draw.states();
	dv.draw.cities();
	dv.draw.hover();
};

// parses the highways column, adds cities to dv.data.highways in the order the appear on the highway
dv.create.highways = function() {
	dv.data.links = [];
	dv.data.highways = {};
	var i, city, cityHwy, fips, hwyNumber, hwyArr, hwyCities, i2,
		hwyData = dv.data.highways,
		msa = dv.data.msa,
		msaIndex = dv.index.msa,
		hwyKeys = [];
	for (i = msa.length - 1; i >= 0; i--) {
		city = msa[i];
		if (city.Highway) {
			cityHwy = city.Highway.split(',');
			for (i2 = cityHwy.length - 1; i2 >= 0; i2--) {
				hwyNumber = cityHwy[i2];
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
		for (i2 = hwyArr.length - 1; i2 >= 0; i2--) {
			fips = hwyArr[i2];
			city = msaIndex[fips];
			hwyCities.push(city.FIPS);
		}
		hwyCities = dv.sort.highway(hwyNumber, hwyCities);
		hwyData[hwyNumber] = hwyCities;
	}
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
		network = dv.index.network,
		source = {},
		target = {},
		i, i2, hwyNumber, highway, fips, fips2, city, city2;

	for (i = hwyIndex.length - 1; i >= 0; i--) {
		hwyNumber = hwyIndex[i];
		highway = highways[hwyNumber];
		for (i2 = highway.length - 1; i2 >= 1; i2--) {
			fips = highway[i2];
			city = msa[fips];
			fips2 = highway[i2-1];
			city2 = msa[fips2];
			source = {geoLng: city.geoLng, geoLat: city.geoLat, fips: city.fips};
			target = {geoLng: city2.geoLng, geoLat: city2.geoLat, fips: city2.fips};
			links.push({source: source, target: target, Highway: hwyNumber});
			network[fips] = network[fips] || {};
			network[fips2] = network[fips2] || {};
			if (!network[fips][fips2]) { network[fips][fips2] = 10; }
			if (!network[fips2][fips]) { network[fips2][fips] = 10; }
		}
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
				.attr('x1', function(d) { return dv.scale.projection([d.source.geoLng, d.source.geoLat])[0]; })
				.attr('y1', function(d) { return dv.scale.projection([d.source.geoLng, d.source.geoLat])[1]; })
				.attr('x2', function(d) { return dv.scale.projection([d.target.geoLng, d.target.geoLat])[0]; })
				.attr('y2', function(d) { return dv.scale.projection([d.target.geoLng, d.target.geoLat])[1]; })
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
				.on('mouseover', function(d) { dv.update.showCityHover(event, d); })
				.on('mouseout', dv.update.hideHover)
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

dv.draw.hover = function() {
	dv.svg.hover = d3.select('body').append('div')
		.attr('id', 'hover')
	;
};

// retrieves the data from files and does a minimal amount of processing
// dv.update.loading tracks asynchronous data calls and calls dv.setup.withData after data is loaded  
dv.get.data = function() {
	dv.update.loading(2);
	d3.csv(dv.opt.path.data, function(error, data) {
		dv.data.msa = data;
		dv.update.loading(-1);
	});
	d3.json('data/us-states.json', function(json) {
		dv.data.states = json.features;
		dv.update.loading(-1);
	});
};

// these functions were all used to generate lat and lng values for each city
dv.update.locating = function(change) {
	dv.state.locating += change;
	if (dv.state.locating === 0) {
		var csv = dv.util.objToCSV(dv.data.msa);
		d3.select('body').append('div')
			.html(csv);
	}
};

dv.update.showCityHover = function(event, d) {
	var html = '<h5>' + d.City + ', ' + d.State + '</h5><ul>';
	html += '<li><strong>Population: </strong>' + d.Population + '</li>';
	html += '<li><strong>Highway(s): </strong>' + d.Highway + '</li>';
	html += '<li><strong>FIPS: </strong>' + d.FIPS + '</li>';
	html += '</ul>';
	dv.update.showHover(event, html);
};

dv.update.showHover = function(event, html) {
	dv.svg.hover
		.style('top', event.pageY - 80 + 'px')
		.style('left', (event.pageX + 20) + 'px')
		.style('display', 'block')
		.html(html)
	;
};

dv.update.hideHover = function() {
	dv.svg.hover.style('display', 'none');

};

dv.get.latlng = function() {
	d3.csv(dv.opt.path.raw, function(error, data) {
		var i = 0,
			city = {},
			address = '',
			loc = {},
			len = data.length,
			timer;

		dv.data.raw = data;
		timer = setInterval(function() {
			while (i < len && dv.data.raw[i].geoLat !== 'undefined') {
				i++;
			}
			if (i < len) {
				dv.update.locating(1);
				getLatLng(i);
				i++;
			} else {
				clearInterval(timer);
			}
		}, 1500);

		function getLatLng(i) {
			city = dv.data.msa[i];
			address = city.City + ', ' + city.State;
			dv.geo.geocode({'address': address}, function(results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					loc = results[0].geometry.location;
					dv.data.raw[i].geoLat = loc.lat();
					dv.data.raw[i].geoLng = loc.lng();
				} else { console.log("Fail: " + status); }
				dv.update.locating(-1);
			});
		}
	});
};

dv.util.objToCSV = function(obj) {
	var i = 0,
		i2 = 0,
		len = 0,
		len2 = 0,
		city = {},
		cols = d3.keys(obj[0]),
		col = '',
		csv = '';
	len = obj.length;
	for (i = 0; i < len; i++) {
		if (csv === '') {
			len2 = cols.length;
			for (i2 = 0; i2 < len2; i2++) {
				col = cols[i2];
				csv += '"' + col + '"';
				if (i2 < len2 - 1) { csv += ','; }
			}
			csv +='</br>';
		}
		city = obj[i];
		len2 = cols.length;
		for (i2 = 0; i2 < len2; i2++) {
			col = cols[i2];
			csv += '"' + city[col] + '"';
			if (i2 < len2 - 1) { csv += ','; }
		}
		csv +='</br>';
	}
	return csv;
};

dv.setup.withoutData();
